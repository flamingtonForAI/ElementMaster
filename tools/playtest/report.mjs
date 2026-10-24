import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
const dir = resolve(process.argv[2] ?? 'output/playtest/jev-xiao-level1-20261022');
const read = file => JSON.parse(readFileSync(`${dir}/${file}`, 'utf8'));
const lines = file => readFileSync(`${dir}/${file}`, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
const run = read('result.json'), meta = read('metadata.json');
const decisions = lines('decisions.jsonl'), allEvents = lines('events.jsonl');
const resultIndex = allEvents.findIndex(e => e.type === 'result');
const events = resultIndex < 0 ? allEvents : allEvents.slice(0, resultIndex + 1);
const damage = events.filter(e => e.type === 'damage');
const upgrades = events.filter(e => e.type === 'upgrade');
const sum = values => values.reduce((a, b) => a + b, 0);
const aggregate = (rows, key) => Object.fromEntries([...new Set(rows.map(key))].map(k => [k, rows.filter(e => key(e) === k)]));
const damageBySource = Object.entries(aggregate(damage, e => `${e.enemy}/${e.attack}`)).map(([source, rows]) => ({
  source, hits: rows.length, hpDamage: sum(rows.map(e => e.hpDamage)), first: rows[0].time, last: rows.at(-1).time,
})).sort((a, b) => b.hpDamage - a.hpDamage);
const kills = events.filter(e => e.type === 'kill');
const killsByType = Object.entries(aggregate(kills, e => e.enemy)).map(([enemy, rows]) => ({
  enemy, kills: rows.length, averageCombatTime: sum(rows.filter(e => e.combatTime !== null).map(e => e.combatTime)) / (rows.filter(e => e.combatTime !== null).length || 1),
}));
const windows = [];
for (let start = 0; start <= run.result.time; start += 30) {
  const states = decisions.filter(e => e.time >= start && e.time < start + 30).map(e => e.state);
  const hits = damage.filter(e => e.time >= start && e.time < start + 30);
  if (states.length) windows.push({ start, end: Math.min(start + 30, run.result.time),
    hpDamage: sum(hits.map(e => e.hpDamage)), minHp: Math.min(...states.map(s => s.hp), ...hits.map(e => e.hpAfter)),
    endHp: start + 30 >= run.result.time ? run.result.hp : states.at(-1).hp, level: states.at(-1).level, kills: start + 30 >= run.result.time ? run.result.kills : states.at(-1).kills,
    maxEnemies: Math.max(...states.map(s => s.enemyCount)),
    stationaryRate: decisions.filter(e => e.time >= start && e.time < start + 30 && e.kind === 'movement' && e.response.answers.action.choice === 'STAY').length / states.length });
}
const movements = decisions.filter(e => e.kind === 'movement');
const summary = { result: run.result, calls: run.calls, inputTokens: run.inputTokens, estimatedInputCostUSD: run.estimatedInputCostUSD,
  latencyMs: run.latencyMs, wallSeconds: run.wallSeconds, damageBySource, killsByType, windows,
  totalHpDamage: sum(damage.map(e => e.hpDamage)),
  minimumHp: Math.min(...damage.map(e => e.hpAfter), ...decisions.map(e => e.state.hp)),
  stationaryRate: movements.filter(e => e.response.answers.action.choice === 'STAY').length / movements.length,
  lowConfidenceCalls: decisions.filter(e => e.response.answers.action.confidence < 0.5).length,
  upgrades: upgrades.map(e => ({ time: e.time, ...e.option })),
  bossSpawn: events.find(e => e.type === 'spawn' && e.boss),
  lastDamage: damage.at(-1), limitations: meta.limitations };
writeFileSync(`${dir}/summary.json`, JSON.stringify(summary, null, 2));
const findings = existsSync(`${dir}/findings.json`) ? read('findings.json') : [];
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const fmt = n => Number(n).toFixed(1);
const time = n => `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}`;
const duration = run.result.time;
const points = decisions.map(e => `${40 + e.time / duration * 920},${210 - e.state.hp / e.state.maxHp * 160}`).join(' ');
const shots = readdirSync(dir).filter(n => /^time-\d+\.png$/.test(n)).sort();
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>五行师 · Jev 第一关试玩记录</title><style>
:root{color-scheme:light}*{box-sizing:border-box}body{margin:0;background:#f3f0e9;color:#232c29;font:16px/1.65 system-ui,sans-serif}main{max-width:1120px;margin:auto;padding:48px 28px}h1{font-size:34px;line-height:1.25;margin:8px 0 20px}h2{margin:42px 0 14px}p{max-width:88ch}.eyebrow{font-size:13px;letter-spacing:2px;color:#63716a}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:28px 0}.stats div{background:#fffdf8;border:1px solid #d8ddd5;padding:20px}.stats strong{display:block;font-size:29px}.muted{color:#65716a;font-size:14px}svg{width:100%;background:#fffdf8;border:1px solid #d8ddd5}table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}td,th{text-align:left;border-bottom:1px solid #d4d9d0;padding:10px 8px}th{font-size:13px;color:#53615a}figure{margin:18px 0}img{display:block;width:100%;border:1px solid #c6cec3;background:#211b1a}input{width:100%;margin-top:14px}.finding{border-left:3px solid #8b6c3f;padding:3px 20px;margin:20px 0}.finding h3{margin:4px 0}.finding p{margin:6px 0}code{font-size:13px}a{color:#28694d}.overflow{overflow:auto}@media(max-width:650px){main{padding:28px 16px}h1{font-size:27px}.stats{grid-template-columns:repeat(2,1fr)}td,th{padding:8px 4px;font-size:13px}}
</style><main><div class="eyebrow">ELEMENTMASTER / 自动试玩记录 / 2026-10-22</div><h1>剑客 · 空白存档 · 荒郊古道</h1>
<p>Jev 在真实 Phaser 游戏中选择八方向移动、停留和升级卡。${run.result.win ? '本盘通关。' : '本盘死亡结束。'}每个动作最多持续 0.5 秒，API 等待时冻结游戏，战斗以 60Hz 固定步长推进。该记录用于发现待验证问题，不能由单盘推断人类玩家的通关率。</p>
<div class="stats"><div>结果<strong>${run.result.win ? '通关' : '死亡'}</strong></div><div>游戏时长<strong>${time(duration)}</strong></div><div>等级<strong>${run.result.level}</strong></div><div>击杀<strong>${run.result.kills}</strong></div></div>
<p class="muted">模型 ${escape(meta.model)} · 种子 ${meta.seed} · API ${run.calls} 次 · 请求延迟 P50 ${run.latencyMs.p50}ms / P95 ${run.latencyMs.p95}ms · 墙钟 ${fmt(run.wallSeconds)} 秒 · 估算输入费用 $${run.estimatedInputCostUSD.toFixed(4)}（按 $0.042 / 百万输入 token，非账单）</p>
<h2>生命曲线</h2><svg viewBox="0 0 1000 245" role="img" aria-label="每次决策时的生命比例随游戏时间变化"><line x1="40" y1="210" x2="960" y2="210" stroke="#ccd3c9"/><line x1="40" y1="50" x2="960" y2="50" stroke="#e3e7df"/><text x="8" y="55" font-size="13">满血</text><text x="18" y="213" font-size="13">0</text><polyline fill="none" stroke="#397955" stroke-width="2.5" points="${points}"/><text x="40" y="235" font-size="13">0:00</text><text x="920" y="235" font-size="13">${time(duration)}</text></svg>
<h2>这一盘发现的线索</h2>${findings.length ? findings.map(f => `<div class="finding"><h3>${escape(f.title)}</h3><p>${escape(f.evidence)}</p><p class="muted">${escape(f.next)}</p></div>`).join('') : '<p>详见 summary.json 中的数值与分段记录。</p>'}
<h2>过程截图</h2><p>拖动查看每 30 秒的画面。完整过程另有逐次决策与逐事件日志。</p><figure><img id="shot" src="${shots[0] ?? 'start.png'}" alt="游戏过程截图"><figcaption id="caption">${escape(shots[0] ?? 'start.png')}</figcaption><input id="slider" type="range" min="0" max="${Math.max(0, shots.length - 1)}" value="0" aria-label="选择游戏截图"></figure>
<h2>每半分钟的压力与成长</h2><div class="overflow"><table><thead><tr><th>区间</th><th>实际掉血</th><th>最低生命</th><th>结束等级</th><th>累计击杀</th><th>最大存活敌人数</th></tr></thead><tbody>${windows.map(w => `<tr><td>${time(w.start)}–${time(w.end)}</td><td>${fmt(w.hpDamage)}</td><td>${fmt(w.minHp)}</td><td>${w.level}</td><td>${w.kills}</td><td>${w.maxEnemies}</td></tr>`).join('')}</tbody></table></div>
<h2>伤害来源</h2><p class="muted">统计扣到生命上的实际伤害；持续伤害单独列为 unknown/status_or_environment，没有强行归给最近的怪。伤害统计不含被无敌帧挡住的攻击。</p><table><thead><tr><th>来源 / 攻击</th><th>命中次数</th><th>实际掉血</th></tr></thead><tbody>${damageBySource.map(d => `<tr><td><code>${escape(d.source)}</code></td><td>${d.hits}</td><td>${fmt(d.hpDamage)}</td></tr>`).join('')}</tbody></table>
<h2>构筑过程</h2><table><thead><tr><th>时间</th><th>选择</th><th>等级</th></tr></thead><tbody>${upgrades.map(e => `<tr><td>${time(e.time)}</td><td><code>${escape(e.option.id ?? e.option.kind)}</code></td><td>${e.option.lv ?? '—'}</td></tr>`).join('')}</tbody></table>
<h2>结算画面</h2><img src="result.png" alt="游戏结算截图">
<h2>原始记录与适用范围</h2><p><a href="result.json">结算 JSON</a> · <a href="summary.json">汇总指标</a> · <a href="metadata.json">实验设置</a> · <a href="decisions.jsonl">完整决策日志</a> · <a href="events.jsonl">战斗事件日志</a></p>
<ul><li>仅第一关剑客、一个随机种子、一次 Jev 策略；未测试其他角色、成长存档或其他构筑。</li><li>机器人能读取结构化状态，并获得无限的墙钟决策时间；这不等同于真人即时操作。</li><li>移动预测仅检查静态敌人与线性弹道，模型另获知敌人速度和行为。动态追逐、冲锋仍可能误判。</li><li>本次初版的种子复现校验未通过：后台调用也消耗了全局随机流。原始一盘和逐次观测仍保留；工具随后将随机流限制在推进帧与确认升级期间，新增独立验证，不将修复后的结果冒充本次原始记录。</li><li>本工具读取部分 TypeScript private 字段（编译后是普通属性），游戏内部结构变化后需先重跑 smoke。</li></ul></main>
<script>const shots=${JSON.stringify(shots)};document.querySelector('#slider').addEventListener('input',e=>{const name=shots[Number(e.target.value)];document.querySelector('#shot').src=name;document.querySelector('#caption').textContent=name});</script></html>`;
writeFileSync(`${dir}/report.html`, html);
console.log(JSON.stringify({ report: `${dir}/report.html`, result: run.result, totalHpDamage: summary.totalHpDamage, damageBySource, windows }, null, 2));
