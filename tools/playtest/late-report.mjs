import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';

const root=resolve(process.argv[2]??'output/playtest/ruan-late-20261025');
const policy=process.env.PLAYTEST_REPORT_POLICY??'Jev';
assert.ok(['Jev','script'].includes(policy),'Report policy must be Jev or script');
const controller=policy==='Jev'?'Jev 1.13.0':'固定策略参照（未调用 Jev）';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const lines=p=>readFileSync(p,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
const sum=xs=>xs.reduce((a,b)=>a+b,0);
const round=n=>+n.toFixed(2);
const fmt=n=>Number(n).toFixed(1);
const time=n=>`${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,'0')}`;
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const names={1:'荒郊古道',2:'竹林',3:'山林',4:'赤焰谷',5:'兵冢古战场',6:'云梦泽',7:'寒江',8:'大漠',9:'东海归墟',10:'昆仑'};
const dirs=readdirSync(root).filter(n=>/^l\d+-s\d+$/.test(n)).sort((a,b)=>Number(a.split('-')[0].slice(1))-Number(b.split('-')[0].slice(1))||a.localeCompare(b));
let referenceHashes,referenceStats,referenceGrowth;
const runs=[];
for(const dir of dirs){
 if(!existsSync(`${root}/${dir}/result.json`))continue;
 const p=`${root}/${dir}`,run=read(`${p}/result.json`),meta=read(`${p}/metadata.json`);
 if(!run.completed)continue;
 const decisions=lines(`${p}/decisions.jsonl`),events=lines(`${p}/events.jsonl`);
 const start=decisions[0].state,last=run.finalSnapshot,m=last.metrics;
 const save=read(`${p}/starting-save.json`);
 const growth=Object.fromEntries(['meta','tree','legacy','clears','wudao','unlocked','lingshi','spent'].map(k=>[k,save[k]]));
 referenceHashes??=meta.sourceHashes;referenceStats??=start.stats;referenceGrowth??=growth;
 assert.deepEqual(meta.sourceHashes,referenceHashes,`${dir}: source changed`);
 assert.deepEqual(start.stats,referenceStats,`${dir}: starting stats differ`);
 assert.deepEqual(growth,referenceGrowth,`${dir}: progression differs`);
 assert.equal(meta.policy,policy);assert.equal(meta.character,'ruan');
 assert.equal(start.level,1);assert.equal(start.skills.length,1);assert.equal(start.time,0);
 assert.deepEqual(start.passives,{});assert.equal(meta.profile.spend,false);
 const hpBalance=start.hp+m.regenEffective+m.consumableHealing+m.chestHealing+m.maxHpGains-m.hpDamage-last.hp;
 assert.ok(Math.abs(hpBalance)<0.02,`${dir}: HP budget ${hpBalance}`);
 assert.equal(m.xpDropped,m.xpCollected+last.xpOnGround,`${dir}: gem XP budget`);
 const movement=decisions.filter(d=>d.kind==='movement');
 const states=[...movement.map(d=>d.state),last];
 const damage=events.filter(e=>e.type==='damage');
 const xp=events.filter(e=>e.type==='xp_pickup');
 const sources=new Map();
 for(const e of damage){const key=`${e.enemy}/${e.attack}`;sources.set(key,(sources.get(key)??0)+e.hpDamage);}
 const vectors={UP:[0,-1],UP_RIGHT:[1,-1],RIGHT:[1,0],DOWN_RIGHT:[1,1],DOWN:[0,1],DOWN_LEFT:[-1,1],LEFT:[-1,0],UP_LEFT:[-1,-1],STAY:[0,0]};
 let reversals=0;
 for(let i=1;i<movement.length;i++){
  const a=vectors[movement[i-1].response.answers.action.choice],b=vectors[movement[i].response.answers.action.choice];
  if(a[0]*b[0]+a[1]*b[1]<0)reversals++;
 }
 // Validate a return against the original drop position, excluding long-range magnet pickups.
 // Sampling is at action boundaries (~0.5 s), so this intentionally undercounts brief returns.
 const returns=[];
 for(const e of xp.filter(e=>e.revisited)){
  if(Math.hypot(e.x-e.bornX,e.y-e.bornY)>100)continue;
  const path=states.filter(s=>s.time>=e.time-e.age && s.time<=e.time);
  const distance=s=>Math.hypot(s.x-e.bornX,s.y-e.bornY);
  const approach=path.findIndex(s=>distance(s)<100);
  if(approach<0)continue;
  const away=path.findIndex((s,i)=>i>approach&&distance(s)>180);
  if(away<0)continue;
  const back=path.findIndex((s,i)=>i>away&&distance(s)<100);
  if(back<0)continue;
  const route=path.slice(approach);
  const area=Math.abs(sum(route.map((s,i)=>{const n=route[(i+1)%route.length];return s.x*n.y-n.x*s.y;})))/2;
  returns.push({time:e.time,value:e.value,age:e.age,denseAtPickup:e.dense,
   denseSeconds:round(route.at(-1).metrics.denseSeconds-route[0].metrics.denseSeconds),
   start:route[0].time,end:route.at(-1).time,pickedUpAt:e.time,excursion:round(Math.max(...route.map(distance))),
   area:round(area),x:e.bornX,y:e.bornY,route:route.map(s=>({time:s.time,x:s.x,y:s.y,hp:s.hp,denseSeconds:s.metrics.denseSeconds}))});
 }
 const windows=[];
 for(let t=0;t<last.time;t+=30){
  const ss=states.filter(s=>s.time>=t&&s.time<t+30),dd=damage.filter(e=>e.time>=t&&e.time<t+30);
  if(ss.length)windows.push({start:t,end:Math.min(t+30,last.time),minHp:Math.min(...ss.map(s=>s.hp),...dd.map(e=>e.hpAfter)),
   damage:round(sum(dd.map(e=>e.hpDamage))),maxEnemies:Math.max(...ss.map(s=>s.enemyCount)),
   maxNearby370:Math.max(...ss.map(s=>sum(s.crowd.map(c=>c.enemies)))),endLevel:ss.at(-1).level,
   denseSeconds:round(ss.at(-1).metrics.denseSeconds-ss[0].metrics.denseSeconds)});
 }
 const shortReturns=returns.filter(e=>e.end-e.start<=75);
 const candidate=[...(shortReturns.length?shortReturns:returns)].sort((a,b)=>(b.denseSeconds>0)-(a.denseSeconds>0)||(b.end>=300)-(a.end>=300)||b.area-a.area)[0];
 const shots=readdirSync(p).filter(f=>/^time-\d+\.png$/.test(f)).sort();
 runs.push({dir,level:meta.level,seed:meta.seed,result:run.result,metrics:m,calls:run.apiCalls,apiErrors:run.apiErrors,
  browserErrors:existsSync(`${p}/browser-errors.log`)?readFileSync(`${p}/browser-errors.log`,'utf8'):null,
  earlyUpgrades:decisions.filter(d=>d.kind==='upgrade'&&d.time<90).map(d=>({time:d.time,
   offered:d.state.options.map(o=>({kind:o.kind,id:o.id,element:o.element,lv:o.lv})),
   selected:d.state.options[Number(d.response.answers.action.choice.slice(7))].id})),
  hpBudgetError:round(hpBalance),xpRecovery:round(m.xpCollected/m.xpDropped*100),
  reversals,reversalRate:round(reversals/Math.max(1,movement.length-1)*100),
  confirmedReturnXp:sum(returns.map(e=>e.value)),confirmedDenseReturnXp:sum(returns.filter(e=>e.denseSeconds>0||e.denseAtPickup).map(e=>e.value)),
  returns,example:candidate,windows,damageBySource:[...sources].sort((a,b)=>b[1]-a[1]).map(([source,hp])=>({source,hp:round(hp)})),
  bossSpawn:events.find(e=>e.type==='spawn'&&e.boss)??null,
  newEnemies:events.filter(e=>e.type==='spawn'&&['bingcan','aoxie','shaxie','jinqiang','yecha','yanshao'].includes(e.enemy)).reduce((map,e)=>{map[e.enemy]??={first:e.time,count:0};map[e.enemy].count++;return map;},{}),
  shots,timeline:states.filter((_,i)=>i%4===0).map(s=>({time:s.time,hp:s.hp,maxHp:s.maxHp,enemies:s.enemyCount}))});
}
const findings=existsSync(`${root}/findings.json`)?read(`${root}/findings.json`):[];
writeFileSync(`${root}/summary.json`,JSON.stringify({policy,runs,startingStats:referenceStats,startingGrowth:referenceGrowth,sourceHashes:referenceHashes,findings},null,2));
const trajectory=r=>{
 const e=r.example;if(!e)return '<p>没有符合“接近 → 离开至少 180px → 回到原掉落点 100px 内”的已验证经验回收。</p>';
 const pts=e.route;const xs=pts.map(p=>p.x).concat(e.x),ys=pts.map(p=>p.y).concat(e.y);
 const left=Math.min(...xs),top=Math.min(...ys),scale=Math.min(500/(Math.max(...xs)-left+80),290/(Math.max(...ys)-top+80));
 const xy=p=>[30+(p.x-left+40)*scale,30+(p.y-top+40)*scale];
 return `<p>${time(e.start)}–${time(e.end)}：离开原经验点最远 ${fmt(e.excursion)}px 后返回；该段密集战斗 ${fmt(e.denseSeconds)} 秒。线为实际走位，橙点为原掉落点，绿点为起点、蓝点为返回点。轨迹只证明这一次有回收路线。</p><svg viewBox="0 0 560 360"><polyline fill="none" stroke="#527b9e" stroke-width="2" points="${pts.map(p=>xy(p).join(',')).join(' ')}"/><circle cx="${xy(e)[0]}" cy="${xy(e)[1]}" r="7" fill="#db9238"/><circle cx="${xy(pts[0])[0]}" cy="${xy(pts[0])[1]}" r="5" fill="#29835c"/><circle cx="${xy(pts.at(-1))[0]}" cy="${xy(pts.at(-1))[1]}" r="5" fill="#345ed3"/>${pts.filter((p,i)=>i%10===0).map(p=>`<text x="${xy(p)[0]+6}" y="${xy(p)[1]-5}" font-size="11">${time(p.time)}</text>`).join('')}</svg>`;
};
const hpChart=r=>`<svg viewBox="0 0 960 180"><text x="20" y="18" font-size="12">生命比例 · 0–100% · 全局 ${time(r.result.time)}</text><path d="M20 35H940M20 100H940M20 165H940" stroke="#dde2dd"/><polyline fill="none" stroke="#34765b" stroke-width="2" points="${r.timeline.map(s=>`${20+s.time/r.result.time*920},${165-s.hp/s.maxHp*130}`).join(' ')}"/></svg>`;
const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>水贼关卡 · ${controller}</title><style>
*{box-sizing:border-box}body{margin:0;background:#f4f2ec;color:#25302d;font:16px/1.7 system-ui,sans-serif}main{max-width:1080px;margin:auto;padding:42px 24px}h1{font-size:30px}h2{margin-top:42px}h3{margin-top:26px}p{max-width:90ch}table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}th,td{text-align:left;padding:10px;border-bottom:1px solid #d9ded8}th{font-size:13px}a{color:#226188}svg{display:block;width:100%;background:#fffdf8;border:1px solid #dce2da}img{width:100%;display:block}small,.muted{color:#60706a}.overflow{overflow-x:auto}input{width:100%}section{border-top:2px solid #c6d2c6;margin-top:42px;padding-top:16px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}.grid>div{min-width:0}.grid td{overflow-wrap:anywhere}@media(max-width:700px){.grid{grid-template-columns:1fr}}.notice{background:#fff6d9;padding:16px 20px}</style><main>
<p class="muted">真实 Phaser 战斗 · ${controller} · 2026-10-25</p><h1>水贼关卡实跑</h1>
<p>使用同一份隔离存档：${referenceGrowth?.tree?.ruan?.length??0} 个已点星图节点、${referenceGrowth?.legacy?.ruan?.length??0} 个传承节点，开局生命 ${referenceStats?.maxHp??"—"} / 护甲 ${referenceStats?.armor??"—"} / 移速 ${referenceStats?.speed??"—"}。每关从 1 级、连弩 1 级开始，正常受伤、掉落、升级和选卡；没有无敌、跳时或赠送局内经验。Jev 独立决定全部走位和选卡，每步 0.5 秒。测试副本共享解锁为 10；每盘固定养成，不增加通关奖励或消费灵石。无养成组清空修炼、已点星图和传承，保留游戏正常起点；日常存档不参与写入。</p>
<p class="notice">${findings.map(f=>`<strong>${esc(f.title)}</strong> ${esc(f.evidence)}`).join('<br>')||'实跑结果如下；未完成的局不计入表格。'} </p>
<div class="overflow"><table><thead><tr><th>关卡 / 种子</th><th>结局 / 时间</th><th>等级</th><th>回收经验</th><th>密集战斗秒数</th><th>确认返回经验</th></tr></thead><tbody>${runs.map(r=>`<tr><td><a href="#${r.dir}">${r.level} ${names[r.level]} / ${r.seed}</a></td><td>${r.result.win?'通关':'死亡'} ${time(r.result.time)}</td><td>${r.result.level}</td><td>${r.metrics.xpCollected}/${r.metrics.xpDropped} (${r.xpRecovery}%)</td><td>${fmt(r.metrics.denseSeconds)}</td><td>${r.confirmedReturnXp}（密集过程 ${r.confirmedDenseReturnXp}）</td></tr>`).join('')}</tbody></table></div>
<p class="muted">“密集”定义为玩家 200px 内至少 30 个存活敌人；“确认返回”要求实际路径先到掉落点 100px 内，再离开 180px，最后回到原地 100px 内拾取，排除远距离吸经验。以每次动作边界采样，可能漏计短暂折返。经验值是拾取倍率之前的球面值；长时间/长路程拾取不自动视为绕行。两种子不等于真人通关率，同养成比较也不代表自然逐关增加投入后的难度。</p>
${runs.map(r=>`<section id="${r.dir}"><h2>第 ${r.level} 关 · ${names[r.level]} · ${r.seed}</h2><p>${r.result.win?'击败 Boss':'战斗死亡'}，${time(r.result.time)}，${r.result.kills} 杀，Lv${r.result.level}。累计实际掉血 ${fmt(r.metrics.hpDamage)}；半血以下 ${fmt(r.metrics.secondsBelowHalf)} 秒；密集时拾取 ${r.metrics.denseXp} 经验。相邻动作反向 ${r.reversalRate}%（描述策略，不能直接归为游戏问题）。</p>${hpChart(r)}
<div class="grid"><div><h3>返回经验点的实际轨迹</h3>${trajectory(r)}</div><div><h3>主要掉血来源</h3><table>${r.damageBySource.slice(0,6).map(s=>`<tr><td>${esc(s.source)}</td><td>${fmt(s.hp)}</td></tr>`).join('')}</table><p class="muted">unknown 保留为未归因伤害；不强行认作地形或最近的怪。</p></div></div>
<h3>实机截图</h3><input type="range" min="0" max="${r.shots.length-1}" value="${r.shots.length-1}" data-run="${r.dir}" aria-label="${r.dir} 截图时间"><small id="caption-${r.dir}">${r.shots.at(-1)}</small><img id="shot-${r.dir}" src="${r.dir}/${r.shots.at(-1)}" alt="第 ${r.level} 关实跑截图">
<details><summary>每 30 秒压力与升级</summary><table><tr><th>时间</th><th>掉血</th><th>最低生命</th><th>场上最多敌人</th><th>370px 内最多</th><th>等级</th></tr>${r.windows.map(w=>`<tr><td>${time(w.start)}–${time(w.end)}</td><td>${fmt(w.damage)}</td><td>${fmt(w.minHp)}</td><td>${w.maxEnemies}</td><td>${w.maxNearby370}</td><td>${w.endLevel}</td></tr>`).join('')}</table></details>
<p><a href="${r.dir}/result.png">结算画面</a> · <a href="${r.dir}/result.json">结算数据</a> · <a href="${r.dir}/decisions.jsonl">完整${policy==='Jev'?' Jev ':'固定策略'}决策</a> · <a href="${r.dir}/events.jsonl">战斗事件</a> · <a href="${r.dir}/metadata.json">代码哈希和配置</a></p></section>`).join('')}
<h2>验证范围</h2><p>${runs.length} 局完成；同批源码 SHA-256、初始属性与养成、每局 HP 收支和经验球收支均经脚本断言一致。控制器读取结构化状态而非仅凭像素，决策之间暂停游戏，暴风雪/沙暴的视觉遮挡没有限制结构化观测；移动风险只作静态几何预测，本报告控制器为${controller}。尚未完成严格整局确定性回放，所以两个种子用于观察重复现象，不作严格配对因果推断。没有用这批样本推导其他角色强弱。</p><p><a href="summary.json">全部汇总与轨迹数据</a></p></main>
<script>const shots=${JSON.stringify(Object.fromEntries(runs.map(r=>[r.dir,r.shots])))};document.querySelectorAll('input[data-run]').forEach(el=>el.addEventListener('input',()=>{const d=el.dataset.run,f=shots[d][Number(el.value)];document.getElementById('shot-'+d).src=d+'/'+f;document.getElementById('caption-'+d).textContent=f;}));</script></html>`;
writeFileSync(`${root}/report.html`,html);
console.log(JSON.stringify({report:`${root}/report.html`,runs:runs.length,results:runs.map(r=>({level:r.level,seed:r.seed,win:r.result.win,time:round(r.result.time),denseSeconds:round(r.metrics.denseSeconds),returnXp:r.confirmedReturnXp,denseReturnXp:r.confirmedDenseReturnXp}))},null,2));
