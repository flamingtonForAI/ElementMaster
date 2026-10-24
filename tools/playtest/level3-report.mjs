import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve('output/playtest');
const prefix = process.env.PLAYTEST_RUN_PREFIX ?? 'level3';
const out = resolve(process.argv[2] ?? `${root}/${prefix}-comparison-20261022`);
mkdirSync(out, { recursive: true });
const names = { xiao: '剑客', qingdai: '药师', moheng: '傀儡师' };
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const rows = [];
for (const character of Object.keys(names)) for (const [regen, policy] of [[0, 'stay'], [5, 'stay'], [5, 'jev']]) {
  const folder = `${prefix}-${character}-regen${regen}-${policy}`;
  const run = read(`${root}/${folder}/result.json`);
  if (!run.completed) throw Error(`Incomplete run: ${folder}`);
  const metadata = read(`${root}/${folder}/metadata.json`);
  const expectedPassives = Object.fromEntries(Object.entries(metadata.profile.passives).filter(([, lv]) => lv > 0));
  if (JSON.stringify(run.result.skills) !== JSON.stringify(metadata.profile.skills) || JSON.stringify(run.result.passives) !== JSON.stringify(expectedPassives)) throw Error(`Build changed during comparison: ${folder}`);
  const events = readFileSync(`${root}/${folder}/events.jsonl`, 'utf8').trim().split('\n').map(JSON.parse);
  const end = events.findIndex(e => e.type === 'result');
  const damage = events.slice(0, end).filter(e => e.type === 'damage');
  const first = JSON.parse(readFileSync(`${root}/${folder}/decisions.jsonl`, 'utf8').split('\n')[0]).state;
  const trajectory = [];
  let lastSecond = -1;
  for (const line of readFileSync(`${root}/${folder}/decisions.jsonl`, 'utf8').trim().split('\n')) {
    const s = JSON.parse(line).state;
    if (Math.floor(s.time) !== lastSecond) { trajectory.push([s.time, s.hp, s.maxHp]); lastSecond = Math.floor(s.time); }
  }
  trajectory.push([run.result.time, run.result.hp, first.maxHp]);
  const m = run.result.metrics;
  const conservationError = first.hp + m.regenEffective + m.consumableHealing + m.chestHealing - m.hpDamage - run.result.hp;
  if (Math.abs(conservationError) > 0.02) throw Error(`HP accounting failed: ${folder}: ${conservationError}`);
  const byAttack = {};
  for (const d of damage) {
    const id = `${d.enemy}/${d.attack}`;
    byAttack[id] ??= { hits: 0, hpDamage: 0 };
    byAttack[id].hits++; byAttack[id].hpDamage += d.hpDamage;
  }
  rows.push({ folder, character, regenLevel: regen, policy, initialStats: first.stats,
    benming: first.benming, result: run.result, metrics: m, byAttack,
    minimumDamageHits: damage.filter(d => d.requested === 1).length,
    fullHpFraction: m.secondsFull / run.result.time, conservationError,
    apiCalls: run.apiCalls, inputTokens: run.inputTokens, estimatedCostUSD: run.estimatedInputCostUSD,
    profile: metadata.profile, trajectory });
}
const summary = { rows, totalApiCalls: rows.reduce((n, r) => n + r.apiCalls, 0),
  estimatedCostUSD: rows.reduce((n, r) => n + r.estimatedCostUSD, 0),
  design: { seeds: [20261022], characters: Object.keys(names), stationaryPairs: 'changsheng 0 versus 5; every other PlayerStats value and benming verified equal by test',
    caveats: ['Synthetic full build granted at 25; not a naturally attainable level-25 opening.', 'One seed per configuration; no population win-rate claim.',
      'Full offensive skills and armor combine with regeneration; no claim that regeneration alone causes invulnerability.',
      'Build growth and XP locked; normal pills and chests remain active and separately measured.',
      'Jev is used only for the three high-regeneration runs; stationary pairs use no AI.',
      'Same seed does not force identical future fights after HP and behavior diverge.'] } };
writeFileSync(`${out}/summary.json`, JSON.stringify(summary, null, 2));
if (process.argv.includes('--summary-only')) {
  console.log(JSON.stringify({ summary: `${out}/summary.json`, rows: rows.length }));
  process.exit(0);
}
const escape = x => String(x).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const time = s => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
const num = n => Number(n).toFixed(1);
const colors = { '0-stay': '#b05a42', '5-stay': '#347758', '5-jev': '#3f64a2' };
const chart = character => `<svg viewBox="0 0 1000 250" role="img" aria-label="${names[character]}生命百分比随游戏时间变化"><path d="M45 30V210H960 M45 120H960 M45 30H960" fill="none" stroke="#d6ddd1"/><text x="4" y="35">100%</text><text x="12" y="125">50%</text><text x="24" y="215">0</text><text x="45" y="238">0:00</text><text x="900" y="238">8:00</text>${rows.filter(r => r.character === character).map(r => `<polyline fill="none" stroke="${colors[`${r.regenLevel}-${r.policy}`]}" stroke-width="2.5" points="${r.trajectory.map(([t, hp, max]) => `${45 + t / 480 * 915},${210 - hp / max * 180}`).join(' ')}"/>`).join('')}</svg>`;
const highXiao = rows.find(r => r.character === 'xiao' && r.policy === 'stay' && r.regenLevel === 5);
const highQing = rows.find(r => r.character === 'qingdai' && r.policy === 'stay' && r.regenLevel === 5);
const highMo = rows.find(r => r.character === 'moheng' && r.policy === 'stay' && r.regenLevel === 5);
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>第 3 关 · 满配回复对照</title><style>
*{box-sizing:border-box}body{margin:0;background:#f4f1ea;color:#243129;font:16px/1.7 system-ui,sans-serif}main{max-width:1160px;margin:auto;padding:45px 24px}h1{font-size:34px;line-height:1.3}h2{margin:36px 0 10px}h3{margin-bottom:8px}.muted{color:#637268;font-size:14px}.note{padding:20px 24px;background:#fffaf0;border-left:4px solid #a97b38}table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}td,th{padding:10px 9px;text-align:left;border-bottom:1px solid #d2d9ce;white-space:nowrap}th{font-size:13px;color:#5a6e5c}.scroll{overflow:auto}svg{display:block;width:100%;background:#fffdf8;border:1px solid #d7ddd0}svg text{font-size:13px;fill:#657164}.legend{display:flex;gap:24px;flex-wrap:wrap;margin:12px 0}img{width:100%;display:block;border:1px solid #b9c9b6}select{font:inherit;padding:8px;max-width:100%;margin:10px 0}a{color:#35684e}code{font-size:13px}.findings li{margin:12px 0}@media(max-width:650px){main{padding:25px 16px}h1{font-size:27px}}
</style><main><p class="muted">ELEMENTMASTER / 第 3 关山林 / 2026-10-22</p><h1>高回复配上高护甲，确实出现了明显的生存跃迁</h1>
<p>三角色各做长生诀 0 / 5 级的站定对照，再用 Jev 各玩一局高回复构筑，共九局。保留原始战斗、落石、异常、Boss 与掉落机制，未修改正式游戏数值。</p>
<div class="note"><strong>这是人为授予的满配压力测试。</strong>统一 25 级、6 术各 8 级；生命、护甲、移速与回春修炼加满，心法偏生存。如此多升级并非正常 25 级开局可自然获得；不能把本结果当成正常推进至第三关的难度。未叠加可购满的星图／传承，未给复活或无敌。锁定经验成长，药瓶与宝箱回血仍保留并单列。</div>
<h2>九局结果</h2><div class="scroll"><table><thead><tr><th>角色</th><th>操控</th><th>长生诀</th><th>回复 / 秒</th><th>生命 / 护甲</th><th>结果</th><th>结束时间</th><th>最低生命</th><th>结算生命</th></tr></thead><tbody>${rows.map(r => `<tr><td>${names[r.character]}</td><td>${r.policy === 'stay' ? '站定' : 'Jev'}</td><td>${r.regenLevel}</td><td>${num(r.initialStats.regen)}</td><td>${r.initialStats.maxHp} / ${r.initialStats.armor}</td><td>${r.result.win ? '通关' : '死亡'}</td><td>${time(r.result.time)}</td><td>${num(r.metrics.minimumHp)}</td><td>${num(r.result.hp)}</td></tr>`).join('')}</tbody></table></div>
<h2>从数据能确定的事</h2><ul class="findings"><li>剑客满长生诀站着打，最低生命 ${num(highXiao.metrics.minimumHp)}/200，约 ${num(highXiao.fullHpFraction * 100)}% 的时间满血；同样配置去掉长生诀，死于 Boss 战。两局采用同一种子，但不是逐帧相同的战斗回放。</li><li>药师不用长生诀也能站定通关。满级长生诀让最低生命达到 ${num(highQing.metrics.minimumHp)}/170；需要同时考虑药师自带回复、等级成长和满级清怪技能。</li><li>傀儡师加满长生诀后仍在 ${time(highMo.result.time)} 死亡，说明回复并不保证所有角色和所有伤害情境都能站住。其本体术伤害减半，后半段落石与持续伤害累积明显。</li><li>机制上，护甲先把许多小怪攻击压到每次 1 点，再被持续回复抹平。普通命中受 0.35 秒无敌帧限制；在每次都只扣 1 点的极端情况下，理论吞吐约 2.86 HP/s，剑客 / 傀儡师的 3.1 HP/s 已高于它。暴击、落石和绕过无敌帧的持续伤害仍能打破这个条件；不是无限生存证明。</li></ul>
<h2>生命曲线</h2><div class="legend"><span style="color:#b05a42">━━ 站定 / 长生 0</span><span style="color:#347758">━━ 站定 / 长生 5</span><span style="color:#3f64a2">━━ Jev / 长生 5</span></div>${Object.keys(names).map(id => `<h3>${names[id]}</h3>${chart(id)}`).join('')}
<h2>实际伤害与回血核对</h2><p class="muted">持续回复只统计真正补回的生命；满血时浪费的回复不算。每局均校验“初始生命 + 实际回复 + 药瓶 + 宝箱 − 实际扣血 = 结算生命”，误差小于 0.02。</p><div class="scroll"><table><thead><tr><th>角色 / 操控 / 长生</th><th>实际扣血</th><th>有效持续回复</th><th>药瓶/回血卡</th><th>宝箱回血</th><th>1 点伤害次数 / 命中数</th><th>满血时间</th></tr></thead><tbody>${rows.map(r => `<tr><td>${names[r.character]} / ${r.policy} / ${r.regenLevel}</td><td>${num(r.metrics.hpDamage)}</td><td>${num(r.metrics.regenEffective)}</td><td>${num(r.metrics.consumableHealing)}</td><td>${num(r.metrics.chestHealing)}</td><td>${r.minimumDamageHits} / ${r.metrics.damageHits}</td><td>${num(r.fullHpFraction * 100)}%</td></tr>`).join('')}</tbody></table></div>
<h2>调整建议</h2><p>优先测试<strong>厚土诀的“生命与护甲双收益”同长生诀叠加的效果</strong>，尤其是高护甲区间大量攻击触及最低伤害后，继续堆回复的收益。先单独比较长生诀高等级的边际收益递减，或厚土诀后几级减少护甲增长；每次只改一项。药师应保留续航特色，傀儡师这一配置仍可能死亡，统一大幅削弱所有回复容易伤到本来较弱的角色。此轮仅诊断，不改数值。</p>
<h2>结算截图与原始记录</h2><select id="run" aria-label="选择试玩记录">${rows.map((r, i) => `<option value="${i}">${names[r.character]} / ${r.policy === 'stay' ? '站定' : 'Jev'} / 长生 ${r.regenLevel}</option>`).join('')}</select><img id="image" src="../${rows[0].folder}/result.png" alt="当前试玩的真实结算截图"><p id="links"></p>
<h2>实验配置与限制</h2><p>共用术：飞剑、飞叶、水龙、石刺、金针雨；第六个术为各自专属术，全部 8 级。心法：厚土、轻身、凝神、柔水、炎阳各 5 级，长生为 0 或 5。洞府通用修炼：气血 5、护体 3、回春 3、身法 3、聚灵 2、悟性 5。无额外星图和传承。三角色配对的生命、护甲、移速、本命及其他 PlayerStats 一致性有自动测试。</p>
<p>每配置一个种子（20261022），站定策略相同；完整动作回放校验仍在第 31 个动作发现击杀差异，说明尚有未隔离的非确定因素；本轮不声称严格随机流配对，高低回复组不保证每个刷怪位置和暴击相同。Jev 固定 jev-1.13.0，API 等待时冻结，0.5 秒一个动作。Jev 组改变走位，因此不用于单独估计长生诀因果效果。未测试正常成长的第三关开局，也未估计总体通关率。</p><p>Jev 合计 ${summary.totalApiCalls} 次调用，估算输入费用 $${summary.estimatedCostUSD.toFixed(3)}。<a href="summary.json">完整汇总 JSON</a></p></main>
<script>const rows=${JSON.stringify(rows.map(r => ({folder:r.folder})))};const select=document.querySelector('#run');function show(){const p='../'+rows[Number(select.value)].folder+'/';document.querySelector('#image').src=p+'result.png';document.querySelector('#links').innerHTML=['result.json','metadata.json','events.jsonl','decisions.jsonl'].map(f=>'<a href="'+p+f+'">'+f+'</a>').join(' · ')}select.addEventListener('change',show);show();</script></html>`;
writeFileSync(`${out}/report.html`, html);
console.log(JSON.stringify({ report: `${out}/report.html`, rows: rows.map(({character,regenLevel,policy,result,initialStats,metrics})=>({character,regenLevel,policy,time:result.time,win:result.win,hp:result.hp,minHp:metrics.minimumHp,regen:initialStats.regen})), totalApiCalls: summary.totalApiCalls }));
