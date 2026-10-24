import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const root=resolve('output/playtest'), out=resolve(process.argv[2]??`${root}/natural3-comparison-20261022`);
mkdirSync(out,{recursive:true});
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const names={xiao:'剑客',qingdai:'药师',moheng:'傀儡师'};
const campaigns=Object.keys(names).map(c=>read(`${root}/growth-${c}-campaign.json`));
for(const c of campaigns)assert.ok(c.complete && [1,2].every(l=>c.save.clears[c.character].includes(l)));
const rows=[];
for(const character of Object.keys(names))for(const policy of ['script','jev'])for(const seed of policy==='script'?[20261022]:[20261022,20261023,20261024]){
 const folder=`natural3-${character}-${policy}-${seed}`, dir=`${root}/${folder}`;
 const run=read(`${dir}/result.json`),meta=read(`${dir}/metadata.json`),save=read(`${dir}/starting-save.json`);
 assert.ok(run.completed,'Run incomplete: '+folder);
 assert.equal(meta.profile.lockXp,undefined);assert.equal(meta.profile.skills,undefined);
 const decisions=readFileSync(`${dir}/decisions.jsonl`,'utf8').trim().split('\n').map(JSON.parse);
 const initial=decisions[0].state;
 assert.equal(initial.level,1);assert.equal(initial.skills.length,1);assert.deepEqual(initial.passives,{});assert.equal(initial.xp,0);
 const m=run.result.metrics;
 const error=initial.hp+m.maxHpGains+m.regenEffective+m.consumableHealing+m.chestHealing-m.hpDamage-run.result.hp;
 assert.ok(Math.abs(error)<0.05,`${folder} HP conservation ${error}`);
 const events=readFileSync(`${dir}/events.jsonl`,'utf8').trim().split('\n').map(JSON.parse);
 const end=events.findIndex(e=>e.type==='result'),active=events.slice(0,end+1),damage=active.filter(e=>e.type==='damage');
 const sources={};for(const e of damage){const key=e.attack==='falling_rock'?'落石':e.attack==='status_or_environment'?'持续伤害/未归因':e.enemy;sources[key]=(sources[key]??0)+e.hpDamage;}
 const trajectory=[];let last=-1;for(const {state:s} of decisions){if(Math.floor(s.time)!==last){trajectory.push([s.time,s.hp,s.maxHp,s.level]);last=Math.floor(s.time);}}
 trajectory.push([run.result.time,run.result.hp,run.finalSnapshot.maxHp,run.result.level]);
 rows.push({folder,character,policy,seed,initialStats:initial.stats,startingSave:save,growthLedger:read(`${dir}/growth-ledger.json`),
  result:run.result,metrics:m,hpAccountingError:error,sources,upgrades:active.filter(e=>e.type==='upgrade').map(e=>({time:e.time,...e.option})),
  lastDamage:damage.slice(-10),trajectory,apiCalls:run.apiCalls,estimatedCostUSD:run.estimatedInputCostUSD,sourceHashes:meta.sourceHashes});
}
for(const c of Object.keys(names)){
 const reference=rows.find(r=>r.character===c);
 for(const r of rows.filter(r=>r.character===c)){
  assert.deepEqual(r.initialStats,reference.initialStats);
  for(const k of ['meta','tree','legacy','clears','lingshi','spent','unlocked'])assert.deepEqual(r.startingSave[k],reference.startingSave[k]);
 }
}
for(const r of rows)assert.deepEqual(r.sourceHashes,rows[0].sourceHashes);
const groups=Object.keys(names).map(character=>{
 const sample=rows.filter(r=>r.character===character&&r.policy==='jev');return {character,observedWins:sample.filter(r=>r.result.win).length,runs:sample.length,
  times:sample.map(r=>r.result.time),minimumHpFractions:sample.map(r=>r.metrics.minimumHpFraction),puppetBreaks:sample.map(r=>r.metrics.puppetBreaks)};
});
const interruptions = readdirSync(root).filter(n=>n.startsWith('natural3-')&&n.endsWith('-interrupted')).map(folder=>{
 const failure=read(`${root}/${folder}/failure.json`);
 const lines=readFileSync(`${root}/${folder}/decisions.jsonl`,'utf8').trim().split('\n').map(JSON.parse);
 return {folder,error:failure.error,lastGameTime:failure.lastSnapshot?.time,apiCalls:lines.length,inputTokens:lines.reduce((n,r)=>n+(r.response.usage?.input_tokens??0),0)};
});
const findings=existsSync(`${out}/findings.json`)?read(`${out}/findings.json`):[];
const summary={campaigns,rows,groups,interruptions,findings,apiCalls:rows.reduce((n,r)=>n+r.apiCalls,0),estimatedCostUSD:rows.reduce((n,r)=>n+r.estimatedCostUSD,0),
 notes:['Real first/second level clears and rewards only. No injected skills, levels or gold.',
 'Moheng required three failed level-two runs, whose real rewards were retained. Budgets differ across roles.',
 'Three seeds per Jev character plus one scripted reference; not a population win-rate estimate.',
 'Same starting save per character; level-three outcomes are not carried to other seeds.',
 'Enemy contact and normal projectile damage share source labels; falling rocks and status damage are separated.',
 'Puppet and player actual HP loss use different mitigation; puppet damage is not an unmitigated tank share.',
 'The observation includes healing pills but omits standalone antidote pickups; the agent cannot intentionally route to an antidote.']};
writeFileSync(`${out}/summary.json`,JSON.stringify(summary,null,2));
const num=n=>Number(n).toFixed(1),time=n=>`${Math.floor(n/60)}:${(n%60).toFixed(1).padStart(4,'0')}`;
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const build=r=>Object.entries(r.result.skills).map(([id,lv])=>`${id} ${lv}`).join(' / ');
const chart=c=>`<svg viewBox="0 0 1000 250" role="img" aria-label="${names[c]}生命比例随游戏时间变化"><path d="M45 30V210H960M45 120H960M45 30H960" fill="none" stroke="#d6dfd0"/><text x="5" y="35">100%</text><text x="12" y="125">50%</text><text x="24" y="214">0</text><text x="45" y="238">0:00</text><text x="916" y="238">10:00</text>${rows.filter(r=>r.character===c).map(r=>`<polyline fill="none" stroke="${r.policy==='script'?'#a87535':['#336950','#456fa0','#8d5f8c'][r.seed-20261022]}" stroke-width="2.2" ${r.policy==='script'?'stroke-dasharray="7 5"':''} points="${r.trajectory.map(([t,hp,max])=>`${45+t/600*915},${210-hp/max*180}`).join(' ')}"/>`).join('')}</svg>`;
const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>正常成长 · 第三关与傀儡师生存</title><style>*{box-sizing:border-box}body{margin:0;background:#f4f0e8;color:#26372d;font:16px/1.7 system-ui,sans-serif}main{max-width:1200px;padding:44px 25px;margin:auto}h1{font-size:34px;line-height:1.3}h2{margin-top:38px}.muted{color:#667563;font-size:14px}.note{padding:18px 23px;border-left:4px solid #9a753e;background:#fff9ed}.scroll{overflow:auto}table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}td,th{padding:10px 8px;text-align:left;border-bottom:1px solid #d4dece;white-space:nowrap}th{font-size:13px;color:#5d715f}svg{width:100%;background:#fffdf8;border:1px solid #d8e0d1}svg text{font-size:13px;fill:#6a786a}img{display:block;width:100%;border:1px solid #bbcbb5}select{font:inherit;padding:8px;max-width:100%}a{color:#326d50}code{font-size:13px}li{margin:10px 0}@media(max-width:650px){main{padding:26px 16px}h1{font-size:27px}}</style><main><p class="muted">ELEMENTMASTER / 正常成长 · 25% 下限保留 / 2026-10-22</p><h1>从真实前两关的奖励，进入第三关</h1><p>三个角色各自使用独立空白存档，由固定脚本实际完成前两关。通关、失败收入都走游戏原结算；只花已有灵石和点数。第三关每局从 1 级和专属术开始，技能和心法完全由本局经验与宝箱获得，没有预送满级技能。</p>
<div class="note">厚土诀和长生诀未改，沿用玩家及傀儡 25% 伤害下限。剑客、药师前两关各一次通过；傀儡师第二关第 4 次才通过，因而多获得 3 次真实失败收入，开局预算高于其他角色。报告按角色固定同一份第三关开局存档，不宣称三角色相同预算。</div>
<h2>本轮判断</h2>${findings.map(f=>`<h3>${esc(f.title)}</h3><p>${esc(f.evidence)}</p><p class="muted">${esc(f.limit)}</p>`).join('')}<h2>进入第三关时的实际属性</h2><div class="scroll"><table><thead><tr><th>角色</th><th>前两关尝试数</th><th>生命</th><th>护甲</th><th>速度</th><th>回复/s</th><th>星图/传承点</th><th>修炼</th></tr></thead><tbody>${Object.keys(names).map(c=>{const r=rows.find(r=>r.character===c),s=r.initialStats,campaign=campaigns.find(x=>x.character===c);return `<tr><td>${names[c]}</td><td>${campaign.runs.length}</td><td>${s.maxHp}</td><td>${s.armor}</td><td>${num(s.speed)}</td><td>${num(s.regen)}</td><td>${r.startingSave.tree[c].length} / ${r.startingSave.legacy[c].length}</td><td>${esc(JSON.stringify(r.startingSave.meta))}</td></tr>`}).join('')}</tbody></table></div>
<h2>第三关观测结果</h2><p>每角色 Jev 三个种子（22/23/24），再加一局固定脚本参考。表内是本次次数，不代表总体通关率。</p><div class="scroll"><table><thead><tr><th>角色</th><th>Jev 观测通关</th><th>Jev 结束时间</th><th>Jev 最低生命比例</th><th>脚本参考</th></tr></thead><tbody>${groups.map(g=>{const s=rows.find(r=>r.character===g.character&&r.policy==='script');return `<tr><td>${names[g.character]}</td><td>${g.observedWins}/${g.runs}</td><td>${g.times.map(time).join(' / ')}</td><td>${g.minimumHpFractions.map(x=>num(x*100)+'%').join(' / ')}</td><td>${s.result.win?'通关':'死亡'} ${time(s.result.time)}</td></tr>`}).join('')}</tbody></table></div>
<h2>傀儡师：本体与召唤物分开看</h2><p>开局 81 生命、6 护甲、69.3 移速，传承投入「坚壁」给傀儡 +30% 生命。傀儡只吸引范围内的普通近战怪；Boss 和远程行为怪不会被它转移仇恨，所以落石、远程和 Boss 对本体仍有威胁。</p><div class="scroll"><table><thead><tr><th>操控/种子</th><th>结果/时间</th><th>本体实际掉血</th><th>傀儡实际掉血</th><th>傀儡破碎次数</th><th>没有傀儡的秒数</th><th>最低生命比例</th></tr></thead><tbody>${rows.filter(r=>r.character==='moheng').map(r=>`<tr><td>${r.policy} / ${r.seed}</td><td>${r.result.win?'通关':'死亡'} ${time(r.result.time)}</td><td>${num(r.metrics.hpDamage)}</td><td>${num(r.metrics.puppetDamage)}</td><td>${r.metrics.puppetBreaks}</td><td>${num(r.metrics.secondsWithoutPuppets)}</td><td>${num(r.metrics.minimumHpFraction*100)}%</td></tr>`).join('')}</tbody></table></div><p class="muted">傀儡与本体有不同减伤、生命和回复机制，实际掉血数字不能直接换算为原始伤害承伤占比；「没有傀儡」统计包含开局召唤前的短暂时间。</p>
<h2>逐局结果、构筑与伤害来源</h2><div class="scroll"><table><thead><tr><th>角色/操控/种子</th><th>结果</th><th>结束时间</th><th>等级</th><th>本体伤害来源</th><th>结束时的术</th><th>结束时的心法</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${names[r.character]} / ${r.policy} / ${r.seed}</td><td>${r.result.win?'通关':'死亡'}</td><td>${time(r.result.time)}</td><td>${r.result.level}</td><td>${Object.entries(r.sources).map(([k,v])=>`${esc(k)} ${num(v)}`).join(' / ')}</td><td>${esc(build(r))}</td><td>${esc(Object.entries(r.result.passives).map(([id,lv])=>`${id} ${lv}`).join(' / '))}</td></tr>`).join('')}</tbody></table></div>
<h2>生命比例曲线</h2><p class="muted">绿/蓝/紫为三个 Jev 种子，棕色虚线为脚本参考。按每次时点的生命上限归一化，避免升级增加生命上限造成误读。</p>${Object.keys(names).map(c=>`<h3>${names[c]}</h3>${chart(c)}`).join('')}
<h2>真实成长过程与预算证据</h2>${campaigns.map(c=>`<h3>${names[c.character]}</h3><ul>${c.runs.map(r=>`<li>第 ${r.level} 关第 ${r.attempt} 次：${r.result.win?'通关':'死亡'}，${time(r.result.time)}，等级 ${r.result.level}。<a href="../${r.folder}/result.json">结算</a> · <a href="../${r.folder}/save.json">结算存档</a></li>`).join('')}</ul>`).join('')}
<h2>截图与原始记录</h2><select id="case" aria-label="选择试玩记录">${rows.map((r,i)=>`<option value="${i}">${names[r.character]} / ${r.policy} / ${r.seed}</option>`).join('')}</select><p id="links"></p><img id="image" src="../${rows[0].folder}/result.png" alt="当前局实际结算截图">
<h2>边界与判断原则</h2><p>本轮对「正常成长」的定义是实际从空白存档打过前两关，再以真实奖励购买修炼、点亮连通星图并领取合法传承。各第三关样本都从同一角色的固定开局重开，未利用第三关失败收益继续变强。每局验证从 1 级单术开始，HP 收支包含升级增加的生命上限。</p><p>脚本与 Jev 的技能选择和走位不同；若 Jev 失败而脚本通过，不能直接判定角色数值不可通关。每角色仅三个 Jev 种子，且傀儡师预算不同，不能给出真人或同预算角色强弱排序。普通弹丸与接触伤害共用部分来源标签，未强行细分；落石和持续伤害另列。当前观测包括回血药，却未列出独立解毒药，代理不能主动规划解毒药路线，但可能路过拾取；毒伤偏高不能单独视为必须加强抗毒的证据。</p><p>另有 ${interruptions.length} 次基础设施中断，保留原始记录后以原存档和种子重跑，不计作死亡。中断样本另消耗 ${interruptions.reduce((n,r)=>n+r.apiCalls,0)} 次已记录调用。热重载隔离经过主动触发验证；历史中断的直接原因未完全确认。</p><p>有效样本 Jev 总调用 ${summary.apiCalls} 次，估算输入费用 $${summary.estimatedCostUSD.toFixed(3)}。<a href="summary.json">全部数据、点数账本、末段伤害与升级选择</a></p></main><script>const rows=${JSON.stringify(rows.map(r=>({folder:r.folder})))};const s=document.querySelector('#case');function show(){const p='../'+rows[Number(s.value)].folder+'/';document.querySelector('#image').src=p+'result.png';document.querySelector('#links').innerHTML=['result.json','starting-save.json','growth-ledger.json','events.jsonl','decisions.jsonl'].map(f=>'<a href="'+p+f+'">'+f+'</a>').join(' · ')}s.addEventListener('change',show);show();</script></html>`;
writeFileSync(`${out}/report.html`,html);
console.log(JSON.stringify({report:`${out}/report.html`,groups,apiCalls:summary.apiCalls,maxHpError:Math.max(...rows.map(r=>Math.abs(r.hpAccountingError)))}));
