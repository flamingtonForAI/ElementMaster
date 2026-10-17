import { GEN_ORDER, EL_INFO, counters, type El } from './elements';

/**
 * 星图：五边形，五行按相生顺序各占一个顶点方向（木在正上方，顺时针）。
 * 结构和数值见 GDD 8.4。坐标单位是星图空间，原点为中宫。
 *
 * - 中宫（太极）：五行散人的起点，其他角色不能点
 * - 本命门：各角色的起点，免费
 * - 内环：五角星中间的小五边形。辐条节点在边的中点，通脉节点在顶点，走它去相邻元素
 * - 辐条：本系专精区，分叉两条各过两个要穴，汇合后再过一个要穴，通向顶点的极境印（门起 16 点）
 * - 克弦：每个通脉节点向两侧各伸出一支：靠近「我」的一支是「破」（打我克的元素），末端是相克奇穴；
 *   靠近邻居的一支是「御」（防克它的元素）
 * - 合化区：破、御两支的末端在相邻两系之间汇成一片，两侧各一个合化奇穴，汇合后通向合化要穴
 */

/**
 * 加成表。百分比都用小数。
 * hp/armor/regen/dmg/crit/critDmg/area/cd/speed/pickup/xp：同 PlayerStats
 * el.X 某系术伤害；res.X 受某系敌人伤害减免；vs.X 攻击某系敌人伤害；lingen.X 初始灵根；
 * off.X 极境印代价：X 以外的术伤害；regenMult 回复倍率；noCrit 无法暴击；
 * slowDur/stunDur 减速/眩晕时长；stillArmor 站立不动时额外护甲；burst 本命爆发伤害；
 * 传承专用见 legacy.ts
 */
export type Mods = Record<string, number>;

export type NodeKind = 'center' | 'gate' | 'small' | 'notable' | 'keystone';

/** 星位所属的两系：合化区是相生（母、子），相克奇穴是克（我、被克） */
export type Pair = { a: El; b: El; rel: 'gen' | 'ctrl' };

export interface StarNode {
  id: string;
  kind: NodeKind;
  /** 颜色归属，中宫、通脉和合化区中段为 null */
  el: El | null;
  /** 跨两系的星位，画成双色 */
  pair?: Pair;
  x: number;
  y: number;
  name: string;
  glyph: string;
  /** 加成之外的规则说明，显示在加成上面 */
  note?: string;
  mods: Mods;
  links: string[];
}

export const CENTER = 'center';

const R_GATE = 50;
/** 内环小五边形的边心距和顶点半径 */
const APO = 100;
const R_INNER = APO / Math.cos((36 * Math.PI) / 180);
/** 极境印所在的半径，洞府按它画底纹、限制镜头 */
export const R_KEY = 660;

const n = (el: El) => EL_INFO[el].name;
const at = (i: number) => GEN_ORDER[(i + 5) % 5];
/** 克 el 的元素 */
const ctrlBy = (el: El) => GEN_ORDER.find((k) => counters(k) === el)!;
const ST: Record<El, string> = { metal: '破绽', wood: '中毒', water: '迟缓', fire: '灼烧', earth: '定身' };

/** 各系的小加成，辐条上隔一个星位带一份 */
const THEME: Record<El, Mods> = {
  metal: { crit: 0.01 },
  wood: { regen: 0.1 },
  water: { cd: 0.015 },
  fire: { area: 0.02 },
  earth: { hp: 0.03 },
};

/** 内环辐条节点和汇合处：每系的通用属性 */
const INNER: Record<El, Mods> = {
  metal: { crit: 0.02 },
  wood: { hp: 0.05 },
  water: { speed: 0.03 },
  fire: { area: 0.04 },
  earth: { armor: 1 },
};

type Notable = { name: string; glyph: string; mods: Mods; note?: string };

/** 每系五个要穴：左支两个、右支两个、汇合后一个 */
const NOTABLES: Record<El, [Notable, Notable, Notable, Notable, Notable]> = {
  metal: [
    { name: '破锋', glyph: '锋', mods: { critDmg: 0.25 } },
    { name: '剑鸣', glyph: '鸣', mods: { 'el.metal': 0.08, crit: 0.02 } },
    { name: '锐意', glyph: '锐', mods: { crit: 0.04 } },
    { name: '透甲', glyph: '透', note: '无视敌人 3 点护甲', mods: { armorPen: 3 } },
    { name: '锋芒', glyph: '芒', note: '对生命高于 70% 的敌人伤害 +20%', mods: { hpHighDmg: 0.2 } },
  ],
  wood: [
    { name: '回春', glyph: '春', mods: { regen: 0.5 } },
    { name: '繁茂', glyph: '茂', mods: { 'el.wood': 0.06, regen: 0.2 } },
    { name: '根深', glyph: '根', mods: { hp: 0.12 } },
    { name: '坚木', glyph: '坚', mods: { hp: 0.08, armor: 1 } },
    { name: '蔓生', glyph: '蔓', note: '你造成的中毒持续时间 +50%', mods: { poisonDur: 0.5 } },
  ],
  water: [
    { name: '流转', glyph: '流', mods: { cd: 0.06 } },
    { name: '涟漪', glyph: '漪', mods: { area: 0.06, 'el.water': 0.05 } },
    { name: '寒潮', glyph: '寒', mods: { slowDur: 0.3, 'el.water': 0.06 } },
    { name: '澄心', glyph: '澄', mods: { cd: 0.04, speed: 0.04 } },
    { name: '潮汐', glyph: '潮', note: '对迟缓中的敌人伤害 +12%', mods: { vsSlow: 0.12 } },
  ],
  fire: [
    { name: '燎原', glyph: '燎', mods: { area: 0.1 } },
    { name: '烈性', glyph: '烈', mods: { 'el.fire': 0.1 } },
    { name: '炎心', glyph: '炎', mods: { dmg: 0.08 } },
    { name: '火势', glyph: '势', mods: { area: 0.05, dmg: 0.04 } },
    { name: '烈焰', glyph: '焰', note: '灼烧最多叠加的层数 +2', mods: { burnMax: 2 } },
  ],
  earth: [
    { name: '厚土', glyph: '厚', mods: { armor: 2 } },
    { name: '坤载', glyph: '坤', mods: { hp: 0.1 } },
    { name: '镇岳', glyph: '岳', mods: { stunDur: 0.3, hp: 0.06 } },
    { name: '山重', glyph: '重', mods: { 'el.earth': 0.08, stunDur: 0.15 } },
    { name: '磐石', glyph: '磐', note: '生命低于 50% 时护甲 +3', mods: { lowArmor: 3 } },
  ],
};

/** 极境印：规则型，有收益也有代价 */
const KEYSTONES: Record<El, Notable> = {
  metal: { name: '白虎印 · 肃杀', glyph: '虎', mods: { critDmg: 0.5, regenMult: -0.5 } },
  wood: { name: '青龙印 · 生生', glyph: '龙', mods: { 'el.wood': 0.25, regen: 0.6, noCrit: 1 } },
  water: { name: '玄武印 · 沉渊', glyph: '玄', mods: { cd: 0.12, slowDur: 0.5, speed: -0.1 } },
  fire: { name: '朱雀印 · 焚身', glyph: '雀', mods: { area: 0.25, 'el.fire': 0.15, hp: -0.15 } },
  earth: { name: '黄龙印 · 不动', glyph: '黄', mods: { armor: 2, stillArmor: 4, speed: -0.12 } },
};

/**
 * 合化区，key 是相生的「母」。a 靠母一侧、b 靠子一侧，各是一个合化奇穴；
 * 合化要穴（hehua.母）让两系术互相附带对方的异常，并加伤同时带两种异常的敌人
 */
const HEHUA: Record<El, { name: string; glyph: string; a: Notable; b: Notable }> = {
  wood: {
    name: '通明', glyph: '明',
    a: { name: '引火', glyph: '引', note: '中毒的敌人身上的灼烧伤害 +60%', mods: { 'hh.poisonBurn': 0.6 } },
    b: { name: '薪传', glyph: '薪', note: '灼烧中的敌人死亡时，把灼烧传给周围的敌人', mods: { 'hh.burnSpread': 1 } },
  },
  fire: {
    name: '陶冶', glyph: '陶',
    a: { name: '余烬', glyph: '烬', note: '灼烧中的敌人死亡时爆开，对周围敌人造成它生命上限 12% 的土系伤害，可能定身', mods: { 'hh.ember': 0.12 } },
    b: { name: '烧结', glyph: '结', note: '定身中的敌人无视护甲，受到伤害 +15%', mods: { 'hh.stunBreak': 0.15 } },
  },
  earth: {
    name: '藏锋', glyph: '藏',
    a: { name: '蓄势', glyph: '蓄', note: '站立不动时暴击率 +8%', mods: { stillCrit: 0.08 } },
    b: { name: '崩岳', glyph: '崩', note: '对定身中的敌人暴击率 +25%', mods: { 'hh.stunCrit': 0.25 } },
  },
  metal: {
    name: '相涵', glyph: '涵',
    a: { name: '霜刃', glyph: '霜', note: '对迟缓中的敌人暴击伤害 +35%', mods: { 'hh.slowCritDmg': 0.35 } },
    b: { name: '凝冰', glyph: '凝', note: '破绽中的敌人被迟缓时冻住，定身 0.6 秒', mods: { 'hh.freeze': 0.6 } },
  },
  water: {
    name: '滋荣', glyph: '滋',
    a: { name: '润泽', glyph: '润', note: '迟缓中的敌人受到的中毒伤害 +60%', mods: { 'hh.slowPoison': 0.6 } },
    b: { name: '甘霖', glyph: '霖', note: '中毒的敌人死亡时回复 0.3 生命', mods: { 'hh.poisonHeal': 0.3 } },
  },
};

/** 合化要穴的两系互附异常几率、同时带两种异常时的增伤 */
export const HEHUA_PROC = 0.2;
export const HEHUA_VULN = 0.2;

/** 相克奇穴，key 是克的一方，效果只对被克的那系敌人 */
const KEXUE: Record<El, Notable> = {
  wood: { name: '盘根', glyph: '盘', note: '土系敌人的护甲对你减半；攻击土系敌人时 20% 几率缠住，迟缓 2 秒', mods: { 'kx.wood': 1 } },
  fire: { name: '熔金', glyph: '熔', note: '攻击金系敌人时 25% 几率灼烧；灼烧中的金系敌人护甲归零', mods: { 'kx.fire': 1 } },
  earth: { name: '筑堤', glyph: '堤', note: '攻击水系敌人时 20% 几率定身 0.6 秒', mods: { 'kx.earth': 1 } },
  water: { name: '灭焰', glyph: '灭', note: '火系敌人死后不再自爆；击杀火系敌人回复 0.3 生命', mods: { 'kx.water': 1 } },
  metal: { name: '伐木', glyph: '伐', note: '生命低于 15% 的木系敌人直接斩杀（Boss 除外）', mods: { 'kx.metal': 1 } },
};

function build(): Record<string, StarNode> {
  const nodes: Record<string, StarNode> = {};
  const add = (id: string, kind: NodeKind, el: El | null, pos: [number, number], name: string, glyph: string, mods: Mods, note?: string, pair?: Pair) => {
    nodes[id] = { id, kind, el, x: Math.round(pos[0]), y: Math.round(pos[1]), name, glyph, mods, note, pair, links: [] };
  };
  const link = (a: string, b: string) => {
    nodes[a].links.push(b);
    nodes[b].links.push(a);
  };
  const chain = (...ids: string[]) => ids.slice(1).forEach((id, i) => link(ids[i], id));
  const pol = (r: number, deg: number): [number, number] => {
    const a = (deg * Math.PI) / 180;
    return [r * Math.cos(a), r * Math.sin(a)];
  };

  add(CENTER, 'center', null, [0, 0], '太极', '极', {}, '五行散人的起点');

  GEN_ORDER.forEach((el, i) => {
    const th = -90 + 72 * i;
    const N = n(el);
    const T = THEME[el];
    const [a1, a2, b1, b2, mid] = NOTABLES[el];
    const k = KEYSTONES[el];
    const E = `el.${el}`;
    const sm = (id: string, r: number, d: number, mods: Mods, name = `${N}术`) => add(`${el}.${id}`, 'small', el, pol(r, th + d), name, '', mods);
    const nt = (id: string, r: number, d: number, x: Notable) => add(`${el}.${id}`, 'notable', el, pol(r, th + d), x.name, x.glyph, x.mods, x.note);
    add(`${el}.gate`, 'gate', el, pol(R_GATE, th), `${N}门`, N, { [E]: 0.03 }, `${N}亲和角色的起点`);
    sm('s1', APO, 0, INNER[el], `${N}脉`);
    sm('s2', 140, 0, { [E]: 0.03 });
    sm('s3', 180, 0, { [E]: 0.03, ...T });
    // 分叉：左右两支各 5 个星位，过两个要穴
    for (const [side, d, n1, n2] of [['a', -1, a1, a2], ['b', 1, b1, b2]] as const) {
      sm(`${side}1`, 218, 6 * d, { [E]: 0.02, ...T });
      sm(`${side}2`, 254, 7 * d, { [E]: 0.02 });
      nt(`${side}n`, 290, 7 * d, n1);
      sm(`${side}3`, 326, 7 * d, { [E]: 0.02, ...T });
      nt(`${side}m`, 362, 6 * d, n2);
    }
    // 汇合后的长尾：中段一个要穴，两侧挂三个灵根
    sm('m1', 400, 0, INNER[el], `${N}脉`);
    sm('m2', 436, 0, { [E]: 0.03 });
    nt('mn', 472, 0, mid);
    sm('m3', 508, 0, { [E]: 0.02, ...T });
    sm('m4', 544, 0, { [E]: 0.03 });
    sm('m5', 580, 0, { [E]: 0.02, ...T });
    sm('m6', 616, 0, { [E]: 0.03 });
    add(`${el}.k`, 'keystone', el, pol(R_KEY, th), k.name, k.glyph, { ...k.mods, [`off.${el}`]: -0.15 });
    sm('l1', 440, -9, { [`lingen.${el}`]: 1 }, `${N}灵根`);
    sm('l2', 548, 8, { [`lingen.${el}`]: 1 }, `${N}灵根`);
    sm('l3', 620, -7, { [`lingen.${el}`]: 1 }, `${N}灵根`);
    add(`${el}.i`, 'small', null, pol(R_INNER, th + 36), '通脉', '', { dmg: 0.03 });

    link(CENTER, `${el}.gate`);
    chain(`${el}.gate`, `${el}.s1`, `${el}.s2`, `${el}.s3`);
    chain(`${el}.m1`, `${el}.m2`, `${el}.mn`, `${el}.m3`, `${el}.m4`, `${el}.m5`, `${el}.m6`, `${el}.k`);
    link(`${el}.m2`, `${el}.l1`);
    link(`${el}.m4`, `${el}.l2`);
    link(`${el}.m6`, `${el}.l3`);
    for (const side of ['a', 'b']) chain(`${el}.s3`, `${el}.${side}1`, `${el}.${side}2`, `${el}.${side}n`, `${el}.${side}3`, `${el}.${side}m`, `${el}.m1`);
    link(`${el}.s1`, `${el}.i`);
  });

  GEN_ORDER.forEach((el, i) => {
    const next = at(i + 1);
    const th = -90 + 72 * i;
    const I = `${el}.i`;
    // 通脉 → 我这一侧：破（打我克的元素），末端是相克奇穴
    const prey = counters(el);
    const vs = `vs.${prey}`;
    const kx = KEXUE[el];
    const ctrl: Pair = { a: el, b: prey, rel: 'ctrl' };
    add(`${el}.kc1`, 'small', el, pol(160, th + 27), `${n(el)}克${n(prey)}`, '', { [vs]: 0.04 });
    add(`${el}.kc2`, 'small', el, pol(198, th + 22), `${n(el)}克${n(prey)}`, '', { [vs]: 0.04 });
    add(`${el}.kt`, 'notable', el, pol(238, th + 19), `破${n(prey)}`, '破', { [vs]: 0.12 });
    add(`${el}.kx`, 'small', el, pol(280, th + 17), `${n(el)}克${n(prey)}`, '', { [vs]: 0.04 });
    add(`${el}.kX`, 'notable', el, pol(320, th + 16), kx.name, kx.glyph, { ...kx.mods, [vs]: 0.05 }, kx.note, ctrl);
    chain(I, `${el}.kc1`, `${el}.kc2`, `${el}.kt`, `${el}.kx`, `${el}.kX`);
    // 通脉 → 邻居一侧：邻居的御（防克它的元素）
    const foe = ctrlBy(next);
    const res = `res.${foe}`;
    add(`${next}.yc1`, 'small', next, pol(160, th + 45), `${n(next)}御${n(foe)}`, '', { [res]: 0.03 });
    add(`${next}.yc2`, 'small', next, pol(198, th + 50), `${n(next)}御${n(foe)}`, '', { [res]: 0.03 });
    add(`${next}.yt`, 'notable', next, pol(238, th + 53), `御${n(foe)}`, '御', { [res]: 0.12 });
    chain(I, `${next}.yc1`, `${next}.yc2`, `${next}.yt`);
    link(I, `${next}.s1`);

    // 合化区：el 生 next
    const h = HEHUA[el];
    const gen: Pair = { a: el, b: next, rel: 'gen' };
    const both = { [`el.${el}`]: 0.02, [`el.${next}`]: 0.02 };
    add(`${el}.za`, 'small', el, pol(275, th + 29), `${n(el)}术`, '', { [`el.${el}`]: 0.03 });
    add(`${el}.zan`, 'notable', el, pol(315, th + 31), h.a.name, h.a.glyph, h.a.mods, h.a.note, gen);
    add(`${el}.zb`, 'small', next, pol(275, th + 43), `${n(next)}术`, '', { [`el.${next}`]: 0.03 });
    add(`${el}.zbn`, 'notable', next, pol(315, th + 41), h.b.name, h.b.glyph, h.b.mods, h.b.note, gen);
    add(`${el}.zc`, 'small', null, pol(355, th + 36), `${n(el)}${n(next)}合化`, '', both, undefined, gen);
    add(`${el}.zc2`, 'small', null, pol(395, th + 36), `${n(el)}${n(next)}合化`, '', { burst: 0.25 }, undefined, gen);
    add(`${el}.zk`, 'notable', null, pol(440, th + 36), `${n(el)}${n(next)}${h.name}`, h.glyph,
      { [`hehua.${el}`]: 1, [`el.${el}`]: 0.05, [`el.${next}`]: 0.05, burst: 0.25 },
      `${n(el)}术命中时 ${HEHUA_PROC * 100}% 几率附带${ST[next]}，${n(next)}术命中时 ${HEHUA_PROC * 100}% 几率附带${ST[el]}；同时${ST[el]}、${ST[next]}的敌人受到伤害 +${HEHUA_VULN * 100}%`, gen);
    chain(`${el}.kt`, `${el}.za`, `${el}.zan`, `${el}.zc`, `${el}.zc2`, `${el}.zk`);
    chain(`${next}.yt`, `${el}.zb`, `${el}.zbn`, `${el}.zc`);
  });
  return nodes;
}

export const STAR: Record<string, StarNode> = build();

/** 点亮的合化要穴：相生的母、子 */
export function hehuaPairs(m: Mods) {
  return GEN_ORDER.flatMap((a, i) => (m[`hehua.${a}`] ? [{ a, b: at(i + 1) }] : []));
}

/** 角色在星图上的起点 */
export function startNode(el: El | null) {
  return el ? `${el}.gate` : CENTER;
}

/** 起点不算在已点亮列表里，但始终视为点亮 */
export function litSet(start: string, lit: string[]) {
  return new Set([start, ...lit]);
}

export function canLight(id: string, start: string, lit: Set<string>) {
  if (lit.has(id)) return false;
  if (id === CENTER && start !== CENTER) return false;
  return STAR[id].links.some((l) => lit.has(l));
}

/** 撤回后剩下的点必须仍和起点连通 */
export function canUnlight(id: string, start: string, lit: Set<string>) {
  if (id === start || !lit.has(id)) return false;
  const rest = new Set(lit);
  rest.delete(id);
  const seen = new Set([start]);
  const q = [start];
  while (q.length) {
    for (const l of STAR[q.pop()!].links) {
      if (rest.has(l) && !seen.has(l)) {
        seen.add(l);
        q.push(l);
      }
    }
  }
  return seen.size === rest.size;
}

export function addMods(into: Mods, m: Mods) {
  for (const k in m) into[k] = (into[k] ?? 0) + m[k];
  return into;
}

const STAT_LABEL: Record<string, [string, 'pct' | 'flat' | 'neg' | 'sec']> = {
  hp: ['生命上限', 'pct'],
  armor: ['护甲', 'flat'],
  regen: ['每秒回复', 'sec'],
  dmg: ['全部伤害', 'pct'],
  crit: ['暴击率', 'pct'],
  critDmg: ['暴击伤害', 'pct'],
  area: ['范围', 'pct'],
  cd: ['冷却', 'neg'],
  speed: ['移动速度', 'pct'],
  pickup: ['拾取范围', 'pct'],
  xp: ['经验', 'pct'],
  slowDur: ['减速时长', 'pct'],
  stunDur: ['眩晕时长', 'pct'],
  burst: ['本命爆发伤害', 'pct'],
  stillArmor: ['站立不动时护甲', 'flat'],
  regenMult: ['生命回复', 'pct'],
  melee: ['近身伤害', 'pct'],
  meleeRange: ['近身判定距离', 'flat'],
};

const sign = (v: number) => (v >= 0 ? '+' : '−');
const pct = (v: number) => `${sign(v)}${Math.round(Math.abs(v) * 1000) / 10}%`;

/** 把加成表写成一行行说明 */
export function describe(m: Mods): string[] {
  const out: string[] = [];
  for (const k in m) {
    const v = m[k];
    const [kind, el] = k.split('.') as [string, El | undefined];
    if (el && EL_INFO[el]) {
      if (kind === 'el') out.push(`${n(el)}系术伤害 ${pct(v)}`);
      else if (kind === 'res') out.push(`受${n(el)}系敌人伤害 −${Math.round(v * 100)}%`);
      else if (kind === 'vs') out.push(`攻击${n(el)}系敌人伤害 ${pct(v)}`);
      else if (kind === 'lingen') out.push(`开局${n(el)}灵根 +${v}`);
      else if (kind === 'off') out.push(`${n(el)}系以外的术伤害 ${pct(v)}`);
      continue;
    }
    if (k === 'noCrit') {
      out.push('无法暴击');
      continue;
    }
    const s = STAT_LABEL[k];
    if (!s) continue;
    const [name, fmt] = s;
    if (fmt === 'pct') out.push(`${name} ${pct(v)}`);
    else if (fmt === 'neg') out.push(`${name} −${Math.round(v * 1000) / 10}%`);
    else if (fmt === 'sec') out.push(`${name} ${sign(v)}${Math.abs(v)}`);
    else out.push(`${name} ${sign(v)}${Math.abs(v)}`);
  }
  return out;
}
