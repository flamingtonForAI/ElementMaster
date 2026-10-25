import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, appendFileSync, writeFileSync, utimesSync } from 'node:fs';
import { resolve } from 'node:path';
import { level3Profile } from './profiles.mjs';
import { MODEL, decisionRequest, validateAnswer, readKey, scriptedAction } from './protocol.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const smoke = process.argv.includes('--smoke');
const replayAt = process.argv.indexOf('--replay');
const replayDir = replayAt < 0 ? null : resolve(process.argv[replayAt + 1] ?? '');
const replay = replayDir ? readFileSync(`${replayDir}/decisions.jsonl`, 'utf8').trim().split('\n').map(JSON.parse) : null;
const replayMeta = replayDir ? JSON.parse(readFileSync(`${replayDir}/metadata.json`, 'utf8')) : null;
const earnedSave = process.env.PLAYTEST_SAVE_FILE ? JSON.parse(readFileSync(process.env.PLAYTEST_SAVE_FILE, 'utf8')) : null;
const profile = process.env.PLAYTEST_PROFILE === 'progression' ? {level:Number(process.env.PLAYTEST_LEVEL ?? 1),character:process.env.PLAYTEST_CHARACTER ?? 'xiao',save:earnedSave,spend:process.env.PLAYTEST_SPEND !== '0'} : replayMeta?.profile ?? (process.env.PLAYTEST_PROFILE === 'level3' ? level3Profile(process.env.PLAYTEST_CHARACTER ?? 'xiao', Number(process.env.PLAYTEST_REGEN ?? 5)) : null);
const stationary = process.env.PLAYTEST_POLICY === 'stay';
const scripted = process.env.PLAYTEST_POLICY === 'script';
const seed = Number(process.env.PLAYTEST_SEED ?? replayMeta?.seed ?? 20261022);
if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw Error('Seed must be an unsigned 32-bit integer');
const out = resolve(process.env.PLAYTEST_OUT ?? `output/playtest/${replay ? 'replay' : smoke ? 'smoke' : 'jev'}-${seed}-${Date.now()}`);
mkdirSync(resolve(out, '..'), { recursive: true });
mkdirSync(out); // Refuse to append to or overwrite an existing experiment.
const key = smoke || replay || stationary || scripted ? null : readKey(readFileSync(process.env.TYPESAFE_KEY_FILE ?? resolve('..', 'harness.md'), 'utf8'));
const started = Date.now();
const sourceHashes = Object.fromEntries(['src/scenes/GameScene.ts', 'src/game/Enemies.ts', 'src/game/Projectiles.ts', 'src/game/Hazards.ts', 'src/game/Pickups.ts', 'src/game/Skills.ts', 'src/game/Build.ts', 'src/game/Puppets.ts', 'src/config/enemies.ts', 'src/config/levels.ts', 'src/config/skills.ts', 'src/config/characters.ts', 'src/config/legacy.ts', 'src/config/meta.ts', 'src/config/startree.ts', 'src/game/save.ts', 'src/game/talents.ts', 'src/game/damage.ts', 'tools/playtest/bridge.js', 'tools/playtest/profiles.mjs', 'tools/playtest/protocol.mjs'].map(file => [file, createHash('sha256').update(readFileSync(file)).digest('hex')]));
const metadata = { variant: process.env.PLAYTEST_VARIANT ?? 'unspecified', sourceHashes, seed, profile, policy: stationary ? 'STAY' : scripted ? 'script' : 'Jev', model: stationary || scripted ? null : MODEL, level: profile?.level ?? 1, character: profile?.character ?? 'xiao', save: 'fresh isolated browser context',
  dt: 1 / 60, actionSeconds: 0.5, decisionClock: 'frozen during API calls', startedAt: new Date().toISOString(),
  limitations: ['One AI-controlled run is not a human skill or balance estimate.',
    'FX randomness is separated; remaining cosmetic randomness may still affect combat RNG.',
    'Movement prediction assumes static enemies; behavior and speed are supplied separately.',
    'Damage source tracked through EnemyManager.hurtOf and scheduled death effects; status damage is not assigned to original caster.',
    'Observed enemy combat time starts at first hitEnemy call, not all possible environmental or status damage.'] };
writeFileSync(`${out}/metadata.json`, JSON.stringify(metadata, null, 2));
console.log(JSON.stringify({ output: out, smoke }));
const browser = await chromium.launch({ channel: process.env.PLAYTEST_BROWSER_CHANNEL ?? 'chrome', headless: true, args: ['--autoplay-policy=user-gesture-required'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
page.on('framenavigated', frame => { if (frame === page.mainFrame()) appendFileSync(`${out}/lifecycle.jsonl`, JSON.stringify({event:'navigate',url:frame.url(),at:new Date().toISOString()})+'\n'); });
page.on('crash', () => appendFileSync(`${out}/lifecycle.jsonl`,JSON.stringify({event:'crash',at:new Date().toISOString()})+'\n'));
// Freeze the loaded dev modules during measured runs; HMR must not reset the game mid-sample.
await page.routeWebSocket(url => ['127.0.0.1','localhost'].includes(url.hostname), ws => {
  const server = ws.connectToServer();
  server.onMessage(message => {
    let payload;
    try { payload = JSON.parse(String(message)); } catch {}
    if (['full-reload','update','prune'].includes(payload?.type)) {
      appendFileSync(`${out}/lifecycle.jsonl`,JSON.stringify({event:'hmr_ignored',payload,at:new Date().toISOString()})+'\n');
      return;
    }
    ws.send(message);
  });
});
page.on('pageerror', error => appendFileSync(`${out}/browser-errors.log`, error.message + '\n'));
let calls = 0, tokens = 0, latencies = [], apiErrors = 0, snapshot, lastShot = -1;
const log = (file, row) => appendFileSync(`${out}/${file}.jsonl`, JSON.stringify(row) + '\n');
async function drain() {
  for (const event of await page.evaluate(() => window.__playtest.drainEvents())) log('events', event);
}
async function screenshot(name) { await page.screenshot({ path: `${out}/${name}.png` }); }
try {
  const url = new URL(process.env.PLAYTEST_URL ?? 'http://127.0.0.1:5180/');
  if (!['127.0.0.1', 'localhost'].includes(url.hostname)) throw Error('Playtest must use a local dev server');
  url.search = `?level=${profile?.level ?? 1}&char=${profile?.character ?? 'xiao'}&hd=0&playtest`;
  await page.goto(url.href);
  await page.waitForFunction(() => window.game?.scene.getScene('game')?.player?.alive, { timeout: 60000 });
  snapshot = await page.evaluate(async ({seed, profile}) => (await import('/tools/playtest/bridge.js')).install(seed, profile).snapshot(), {seed, profile});
  if (process.env.PLAYTEST_HMR_PROBE) {
    const now = new Date(); utimesSync('tools/playtest/bridge.js',now,now);
    await new Promise(r=>setTimeout(r,1000));
    if (!await page.evaluate(()=>!!window.__playtest)) throw Error('HMR reset the controlled game');
  }
  if (!profile && (snapshot.time !== 0 || snapshot.hp !== 100 || snapshot.level !== 1 || snapshot.skills.length !== 1 ||
      snapshot.skills[0].id !== 'slash' || Object.keys(snapshot.passives).length)) throw Error('Fresh-run invariant failed');
  if (profile?.skills && (snapshot.time !== 0 || snapshot.level !== 25 || snapshot.skills.length !== 6 || snapshot.hp !== snapshot.maxHp || snapshot.levelId !== 3)) throw Error('Level-three preset invariant failed');
  if (profile && !profile.skills && (snapshot.time !== 0 || snapshot.level !== 1 || snapshot.skills.length !== 1 || Object.keys(snapshot.passives).length)) throw Error('Natural progression must start with one skill at level 1');
  writeFileSync(`${out}/starting-save.json`, JSON.stringify(await page.evaluate(() => window.__playtest.startingSave), null, 2));
  writeFileSync(`${out}/growth-ledger.json`, JSON.stringify(await page.evaluate(() => window.__playtest.growthLedger), null, 2));
  await screenshot('start');
  await drain();
  if (smoke) {
    const before = snapshot;
    const outcome = await page.evaluate(() => window.__playtest.advance('RIGHT'));
    if (Math.abs(outcome.advanced - 0.5) > 1e-6 || Math.abs(outcome.moved - (profile ? snapshot.stats.speed * 0.5 : 36)) > 1e-5) throw Error('Fixed-step movement invariant failed');
    const frozen = await page.evaluate(() => window.__playtest.snapshot().time);
    await new Promise(r => setTimeout(r, 300));
    if (await page.evaluate(() => window.__playtest.snapshot().time) !== frozen) throw Error('Game advanced during decision wait');
    if (profile?.skills) {
      if (snapshot.stats.regen <= 0 || snapshot.stats.speed <= 90 || snapshot.stats.armor < 8) throw Error('Preset stats invalid');
      console.log(JSON.stringify({ profileSmokePassed: true, stats: snapshot.stats, benming: snapshot.benming }));
    }
    // Verify the real upgrade UI and applyOption path using a deliberate debug XP grant in smoke only.
    await page.evaluate(() => {
      const g = window.game.scene.getScene('game');
      if (g.levelDef.id === 3) g.pendingLevelUps++;
      else g.gainXp(g.build.xpNeeded());
      window.__playtest.advance('STAY', 1);
    });
    const offers = await page.evaluate(() => window.__playtest.snapshot().options);
    if (profile ? offers.length < 1 : offers.length !== 3) throw Error('Unexpected upgrade choices');
    await page.evaluate(() => window.__playtest.choose(0));
    const resumed = await page.evaluate(() => window.__playtest.advance('STAY', 1));
    if (resumed.advanced <= 0) throw Error('Upgrade did not resume combat');
    snapshot = resumed.snapshot;
    const trajectory = [];
    for (let i = 0; i < 30; i++) {
      if (process.env.PLAYTEST_IDLE_NOISE) await page.evaluate(() => { for (let n = 0; n < 1000; n++) Math.random(); });
      const action = ['RIGHT', 'DOWN', 'LEFT', 'UP', 'STAY'][Math.floor(i / 3) % 5];
      if (snapshot.options.length) snapshot = await page.evaluate(() => window.__playtest.choose(0));
      snapshot = (await page.evaluate(a => window.__playtest.advance(a), action)).snapshot;
      trajectory.push(snapshot);
    }
    writeFileSync(`${out}/smoke-trajectory.json`, JSON.stringify(trajectory));
    await drain();
    console.log(JSON.stringify({ smokePassed: true, movement: outcome.moved, time: outcome.advanced, initialHP: before.hp, upgradeChoices: offers.length }));
  } else if (replay) {
    for (const recorded of replay) {
      for (const field of ['time', 'hp', 'x', 'y', 'level', 'xp', 'kills', 'benming', 'skills', 'passives']) {
        if (JSON.stringify(snapshot[field]) !== JSON.stringify(recorded.state[field])) {
          throw Error(`Replay diverged at call ${recorded.call}, field ${field}`);
        }
      }
      const choice = recorded.response.answers.action.choice;
      snapshot = recorded.kind === 'upgrade'
        ? await page.evaluate(i => window.__playtest.choose(i), Number(choice.slice(7)))
        : (await page.evaluate(action => window.__playtest.advance(action), choice)).snapshot;
      calls++;
      await drain();
    }
    const expected = JSON.parse(readFileSync(`${replayDir}/result.json`, 'utf8')).result;
    if (JSON.stringify(snapshot.result) !== JSON.stringify(expected)) throw Error('Replay result diverged');
    await screenshot('result');
    writeFileSync(`${out}/replay-verification.json`, JSON.stringify({ matchedDecisions: calls, result: snapshot.result, source: replayDir, apiCalls: 0 }, null, 2));
    console.log(JSON.stringify({ replayPassed: true, matchedDecisions: calls }));
  } else {
    // 第 10 关本身长 15 分钟；原先的 720 秒限额会把正常局误记成中断。
    const maxSeconds = (snapshot.duration ?? 600) + 180;
    const maxDecisions = maxSeconds * 2 + 300;
    while (!snapshot.over && snapshot.time < maxSeconds && calls < maxDecisions) {
      const request = decisionRequest(snapshot, calls);
      let response, answer, ms;
      if (stationary || scripted) {
        answer = { choice: scripted ? scriptedAction(snapshot) : snapshot.options.length ? 'option_0' : 'STAY', type: 'choice', confidence: 1 };
        response = { model: null, answers: { action: answer }, usage: { input_tokens: 0 } };
        ms = 0;
      }
      for (let attempt = 0; !stationary && !scripted && attempt < 3; attempt++) {
        const t = performance.now();
        try {
          const res = await fetch('https://api.typesafe.ai/v1/systemone', {
            method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(request), signal: AbortSignal.timeout(30000),
          });
          if (!res.ok) throw Error(`TypeSafe HTTP ${res.status}`);
          response = await res.json();
          answer = validateAnswer(response, request);
          ms = Math.round(performance.now() - t);
          break;
        } catch (error) {
          apiErrors++;
          log('api-errors', { call: calls, attempt, error: error.message });
          if (attempt === 2) throw error;
          await new Promise(r => setTimeout(r, 1000 * 2 ** attempt));
        }
      }
      calls++;
      tokens += response.usage?.input_tokens ?? 0;
      latencies.push(ms);
      log('decisions', { call: calls, time: snapshot.time, kind: snapshot.options.length ? 'upgrade' : 'movement',
        state: snapshot, request, response, latencyMs: ms });
      if (snapshot.options.length) snapshot = await page.evaluate(i => window.__playtest.choose(i), Number(answer.choice.slice(7)));
      else snapshot = (await page.evaluate(action => window.__playtest.advance(action), answer.choice)).snapshot;
      await drain();
      if (Math.floor(snapshot.time / 30) !== lastShot) {
        lastShot = Math.floor(snapshot.time / 30);
        await screenshot(`time-${String(Math.floor(snapshot.time)).padStart(3, '0')}`);
        console.log(JSON.stringify({ gameTime: snapshot.time, hp: snapshot.hp, level: snapshot.level, kills: snapshot.kills,
          enemyCount: snapshot.enemyCount, boss: snapshot.boss, calls, wallSeconds: Math.round((Date.now() - started) / 1000) }));
      }
    }
    if (!snapshot.over) throw Error('Run reached safety limit without in-game result');
    snapshot = await page.evaluate(() => window.__playtest.finish());
    await drain();
    await screenshot('result');
  }
  writeFileSync(`${out}/save.json`, JSON.stringify(await page.evaluate(() => window.__playtest.readSave()), null, 2));
  latencies.sort((a, b) => a - b);
  writeFileSync(`${out}/result.json`, JSON.stringify({ completed: !smoke && snapshot.over, smoke, result: snapshot.result,
    finalSnapshot: snapshot, calls, apiCalls: replay || stationary || scripted ? 0 : calls, replay: !!replay, apiErrors, inputTokens: tokens, estimatedInputCostUSD: tokens * 0.042 / 1e6,
    latencyMs: { p50: latencies[Math.floor(latencies.length * 0.5)], p95: latencies[Math.floor(latencies.length * 0.95)] },
    wallSeconds: (Date.now() - started) / 1000 }, null, 2));
  console.log(JSON.stringify({ finished: true, result: snapshot.result, calls, out }));
} catch (error) {
  if (page && !page.isClosed()) {
    try { await drain(); } catch {}
    try { await screenshot('failure'); } catch {}
  }
  writeFileSync(`${out}/failure.json`, JSON.stringify({ error: error.message, calls, lastSnapshot: snapshot }, null, 2));
  console.error(error.message);
  process.exitCode = 1;
} finally { await browser.close(); }
