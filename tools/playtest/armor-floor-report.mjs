import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const root = resolve('output/playtest');
const out = resolve(process.argv[2] ?? `${root}/level3-floor25-comparison-20261022`);
const before = JSON.parse(readFileSync(`${root}/level3-comparison-20261022/summary.json`, 'utf8'));
const after = JSON.parse(readFileSync(`${out}/summary.json`, 'utf8'));
const names = { xiao: '剑客', qingdai: '药师', moheng: '傀儡师' };
const pairs = after.rows.map(b => {
  const a = before.rows.find(a => a.character === b.character && a.policy === b.policy && a.regenLevel === b.regenLevel);
  assert.ok(a, 'Missing baseline');
  assert.deepEqual(b.profile, a.profile, 'Profile changed');
  assert.deepEqual(b.initialStats, a.initialStats, 'Initial stats changed');
  assert.equal(b.benming, a.benming, 'Benming changed');
  const meta = JSON.parse(readFileSync(`${root}/${b.folder}/metadata.json`, 'utf8'));
  assert.equal(meta.variant, 'armor-floor25');
  assert.equal(meta.seed, 20261022);
  return { character: b.character, regenLevel: b.regenLevel, policy: b.policy, before: a, after: b };
});
assert.equal(pairs.length, 9);
const sourceHashes = pairs.map(p => JSON.parse(readFileSync(`${root}/${p.after.folder}/metadata.json`, 'utf8')).sourceHashes);
for (const hashes of sourceHashes) assert.deepEqual(hashes, sourceHashes[0], 'Source changed during batch');
const summary = { change: { player: 'max(1, ceil(incoming*0.25), round(incoming-armor)); incoming includes crit, element relation, resist',
  puppet: 'same floor after STONE and shell element relationship', houtu: 'unchanged', changsheng: 'unchanged' },
  initialProfilesVerifiedEqual: true, batchSourceHashes: sourceHashes[0], pairs,
  apiCalls: after.totalApiCalls, estimatedCostUSD: after.estimatedCostUSD,
  limitations: ['Synthetic full build, not normal level-three progression.', 'One seed per case; baseline replay is not exactly deterministic.',
    'Jev chooses fresh actions from changed states, so incoming hit counts and paths differ.',
    'Player and puppet armor floors changed together; puppet-specific causal contribution not isolated.'] };
writeFileSync(`${out}/before-after.json`, JSON.stringify(summary, null, 2));
const escape = x => String(x).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const num = n => Number(n).toFixed(1);
const time = n => `${Math.floor(n / 60)}:${(n % 60).toFixed(1).padStart(4, '0')}`;
const outcome = r => `${r.result.win ? '通关' : '死亡'} ${time(r.result.time)}`;
const label = p => `${names[p.character]} · ${p.policy === 'stay' ? '站定' : 'Jev'} · 长生 ${p.regenLevel}`;
const stationaryHigh = pairs.filter(p => p.policy === 'stay' && p.regenLevel === 5);
const jevHigh = pairs.filter(p => p.policy === 'jev');
const chart = character => `<svg viewBox="0 0 1000 250" role="img" aria-label="${names[character]}满长生生命百分比前后比较"><path d="M45 30V210H960M45 120H960M45 30H960" fill="none" stroke="#d3dccd"/><text x="4" y="35">100%</text><text x="12" y="125">50%</text><text x="23" y="215">0</text><text x="45" y="238">0:00</text><text x="920" y="238">8:00</text>${pairs.filter(p => p.character === character && p.regenLevel === 5).map(p => ['before','after'].map(phase => `<polyline fill="none" stroke="${p.policy === 'stay' ? '#88643a' : '#33745f'}" stroke-width="2.4" ${phase === 'before' ? 'stroke-dasharray="6 5" opacity="0.55"' : ''} points="${p[phase].trajectory.map(([t,hp,max]) => `${45 + t / 480 * 915},${210 - hp / max * 180}`).join(' ')}"/>`).join('')).join('')}</svg>`;
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>25% 伤害下限 · 第三关前后对照</title><style>
*{box-sizing:border-box}body{margin:0;background:#f4f0e8;color:#27342c;font:16px/1.7 system-ui,sans-serif}main{max-width:1200px;margin:auto;padding:44px 25px}h1{font-size:34px;line-height:1.3}h2{margin:38px 0 12px}.muted{color:#677466;font-size:14px}.note{border-left:4px solid #a67d3e;background:#fffaf0;padding:18px 22px}.scroll{overflow:auto}table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}th,td{text-align:left;padding:10px 8px;border-bottom:1px solid #d6dccf;white-space:nowrap}th{font-size:13px;color:#60705d}svg{width:100%;background:#fffdf8;border:1px solid #d6decd}svg text{font-size:13px;fill:#697564}select{font:inherit;max-width:100%;padding:8px}img{width:100%;display:block;border:1px solid #bdcab5}.shots{display:grid;grid-template-columns:1fr 1fr;gap:18px}.shots figure{margin:0}a{color:#326c50}code{font-size:13px}li{margin:10px 0}@media(max-width:650px){main{padding:26px 16px}h1{font-size:27px}.shots{grid-template-columns:1fr}}
</style><main><p class="muted">ELEMENTMASTER / 第 1 步：玩家与傀儡的 25% 伤害下限 / 2026-10-22</p><h1>伤害下限修改：第三关九配置前后对照</h1>
<p>只改玩家和傀儡两处护甲公式，长生诀、厚土诀、敌人、技能与成长配置均保持原值。重新运行原来的六局站定测试与三局 Jev，完整保留修改前的九局记录。</p><div class="note">所有比较项的初始构筑、PlayerStats、本命与种子均已程序核对相同。仍是人为授予 25 级、六术满级的压力测试，不代表正常第三关开局；基线存在严格回放偏差，Jev 也会重新选择走位，因此不能把一次前后差异当作稳定通关率或精确因果效应。</div>
<h2>这次结果</h2><ul>${stationaryHigh.map(p => `<li>${names[p.character]}满长生站定：${outcome(p.before)} → ${outcome(p.after)}；最低生命 ${num(p.before.metrics.minimumHp)} → ${num(p.after.metrics.minimumHp)} / ${p.after.initialStats.maxHp}，实际累计掉血 ${num(p.before.metrics.hpDamage)} → ${num(p.after.metrics.hpDamage)}。</li>`).join('')}<li>Jev 满回复：修改前 ${jevHigh.filter(p=>p.before.result.win).length}/3 通关，修改后 ${jevHigh.filter(p=>p.after.result.win).length}/3 通关。${jevHigh.map(p => `${names[p.character]}最低生命 ${num(p.before.metrics.minimumHp)} → ${num(p.after.metrics.minimumHp)}`).join('；')}。</li></ul>
<h2>九个配置逐项比较</h2><div class="scroll"><table><thead><tr><th>配置</th><th>修改前结果</th><th>25% 下限结果</th><th>最低生命 前→后</th><th>结算生命 前→后</th></tr></thead><tbody>${pairs.map(p=>`<tr><td>${label(p)}</td><td>${outcome(p.before)}</td><td>${outcome(p.after)}</td><td>${num(p.before.metrics.minimumHp)} → ${num(p.after.metrics.minimumHp)}</td><td>${num(p.before.result.hp)} → ${num(p.after.result.hp)}</td></tr>`).join('')}</tbody></table></div>
<h2>生命曲线</h2><p class="muted">只画满长生构筑。棕色：站定；绿色：Jev。虚线：修改前；实线：25% 下限。纵轴为生命百分比。</p>${Object.keys(names).map(c=>`<h3>${names[c]}</h3>${chart(c)}`).join('')}
<h2>累计掉血与有效回复</h2><p class="muted">两组存活时间、受击次数和走位可能不同，累计掉血不等同于相同攻击序列的减伤倍率。每局 HP 收支均通过校验。</p><div class="scroll"><table><thead><tr><th>配置</th><th>实际掉血 前→后</th><th>有效持续回复 前→后</th><th>满血时间占比 前→后</th><th>受击数 前→后</th></tr></thead><tbody>${pairs.map(p=>`<tr><td>${label(p)}</td><td>${num(p.before.metrics.hpDamage)} → ${num(p.after.metrics.hpDamage)}</td><td>${num(p.before.metrics.regenEffective)} → ${num(p.after.metrics.regenEffective)}</td><td>${num(p.before.fullHpFraction*100)}% → ${num(p.after.fullHpFraction*100)}%</td><td>${p.before.metrics.damageHits} → ${p.after.metrics.damageHits}</td></tr>`).join('')}</tbody></table></div>
<h2>对修改的判断</h2><p>25% 下限让高护甲时的有效受伤增加，但本组满回复剑客、药师仍可站定通关。傀儡师的本体与召唤物同时采用新下限，站定生存时间缩短，需要在后续正常成长测试里重点观察。此轮不足以认定 25% 已达到最终平衡，也不支持立即叠加削弱厚土或长生。</p><p>按既定顺序，下一步验证正常成长的第三关配置，再决定是否调整厚土诀；本轮没有补偿生命、改回复或调整怪物。</p>
<h2>公式与边界</h2><p><code>damage = max(1, ceil(incoming × 0.25), round(incoming − armor))</code></p><p>玩家 incoming 包含暴击、五行关系和抗性；傀儡 incoming 包含石身减半和外壳五行。原有玩家 0.35 秒无敌帧和持续伤害路径保留。下限不是所有命中都至少 2 点：incoming ≤ 4 时仍可能只扣 1；减甲后伤害更高时继续用减甲结果。78 项测试及构建通过。</p>
<h2>结算画面对照</h2><select id="case" aria-label="选择测试配置">${pairs.map((p,i)=>`<option value="${i}">${label(p)}</option>`).join('')}</select><div class="shots"><figure><p>修改前</p><img id="before" src="../${pairs[0].before.folder}/result.png" alt="修改前真实结算截图"><p id="before-links"></p></figure><figure><p>25% 下限</p><img id="after" src="../${pairs[0].after.folder}/result.png" alt="25%下限真实结算截图"><p id="after-links"></p></figure></div>
<h2>原始证据与范围</h2><p><a href="before-after.json">逐项前后数据及源码哈希</a> · <a href="summary.json">新九局汇总</a> · <a href="../level3-comparison-20261022/report.html">上一轮报告</a></p><p>角色为剑客、药师、傀儡师。站定组各比较长生 0 与 5；Jev 组三角色均长生 5。共用术为飞剑、飞叶、水龙、石刺、金针雨，加角色专属术，均 8 级；其余心法与局外修炼不变；锁定经验成长，正常掉落回血单独记录。无新增星图、传承、无敌或复活。</p><p>新 Jev 调用 ${after.totalApiCalls} 次，估算输入费用 $${after.estimatedCostUSD.toFixed(3)}。全部为同一种子的一次观测，尚未覆盖正常成长、其他关卡和跨种子分布。</p></main><script>const pairs=${JSON.stringify(pairs.map(p=>({before:p.before.folder,after:p.after.folder})))};const selector=document.querySelector('#case');function show(){const p=pairs[Number(selector.value)];for(const phase of ['before','after']){const path='../'+p[phase]+'/';document.querySelector('#'+phase).src=path+'result.png';document.querySelector('#'+phase+'-links').innerHTML=['result.json','metadata.json','events.jsonl','decisions.jsonl'].map(f=>'<a href="'+path+f+'">'+f+'</a>').join(' · ')}}selector.addEventListener('change',show);show();</script></html>`;
writeFileSync(`${out}/report.html`, html);
console.log(JSON.stringify({ report: `${out}/report.html`, profilesVerified: pairs.length, apiCalls: after.totalApiCalls,
  rows: pairs.map(p=>({character:p.character,policy:p.policy,regen:p.regenLevel,before:outcome(p.before),after:outcome(p.after),minHpBefore:p.before.metrics.minimumHp,minHpAfter:p.after.metrics.minimumHp})) }));
