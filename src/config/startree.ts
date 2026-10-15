import { GEN_ORDER, EL_INFO, counters, type El } from './elements';

/**
 * 星图：五边形，五行按相生顺序各占一个顶点方向（木在正上方，顺时针）。
 * 结构和数值见 GDD 8.4。坐标单位是星图空间，原点为中宫。
 *
 * - 中宫（太极）：五行散人的起点，其他角色不能点
 * - 本命门：各角色的起点，免费
 * - 内环：五角星中间的小五边形。辐条节点在边的中点，通脉节点在顶点，走它去相邻元素
 * - 辐条：本系专精区，分叉两条各过一个要穴，汇合后通向顶点的极境印
 * - 克弦：五角星的线。每个通脉节点向两侧顶点各伸出一支：靠近「我」的一端是「破」（打我克的元素），
 *   靠近邻居的一端是「御」（防克它的元素）
 * - 相生桥：两条克弦的末端在相邻两个顶点之间连起来，中点是两系的合化要穴
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

export interface StarNode {
  id: string;
  kind: NodeKind;
  /** 颜色归属，中宫和通脉为 null */
  el: El | null;
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
/** 内环小五边形的边心距；五角星顶点 = 边心距 / cos72° */
const APO = 100;
const R_STAR = APO / Math.cos((72 * Math.PI) / 180);
const R_INNER = APO / Math.cos((36 * Math.PI) / 180);

const n = (el: El) => EL_INFO[el].name;
const at = (i: number) => GEN_ORDER[(i + 5) % 5];
/** 克 el 的元素 */
const ctrlBy = (el: El) => GEN_ORDER.find((k) => counters(k) === el)!;

/** 各系的小加成，辐条上每个小星位带一份 */
const THEME: Record<El, Mods> = {
  metal: { crit: 0.01 },
  wood: { regen: 0.1 },
  water: { cd: 0.015 },
  fire: { area: 0.02 },
  earth: { hp: 0.03 },
};

/** 内环辐条节点：每系的通用属性 */
const INNER: Record<El, Mods> = {
  metal: { crit: 0.02 },
  wood: { hp: 0.05 },
  water: { speed: 0.03 },
  fire: { area: 0.04 },
  earth: { armor: 1 },
};

type Notable = { name: string; glyph: string; mods: Mods; note?: string };

/** 每系两个要穴：分叉左支、右支 */
const NOTABLES: Record<El, [Notable, Notable]> = {
  metal: [
    { name: '破锋', glyph: '锋', mods: { critDmg: 0.25 } },
    { name: '锐意', glyph: '锐', mods: { crit: 0.04 } },
  ],
  wood: [
    { name: '回春', glyph: '春', mods: { regen: 0.5 } },
    { name: '根深', glyph: '根', mods: { hp: 0.12 } },
  ],
  water: [
    { name: '流转', glyph: '流', mods: { cd: 0.06 } },
    { name: '寒潮', glyph: '寒', mods: { slowDur: 0.3, 'el.water': 0.06 } },
  ],
  fire: [
    { name: '燎原', glyph: '燎', mods: { area: 0.1 } },
    { name: '炎心', glyph: '炎', mods: { dmg: 0.08 } },
  ],
  earth: [
    { name: '厚土', glyph: '厚', mods: { armor: 2 } },
    { name: '镇岳', glyph: '岳', mods: { stunDur: 0.3, hp: 0.06 } },
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

/** 相生合化，key 是相生的「母」 */
const HEHUA: Record<El, { name: string; glyph: string }> = {
  wood: { name: '通明', glyph: '明' },
  fire: { name: '陶冶', glyph: '陶' },
  earth: { name: '藏锋', glyph: '藏' },
  metal: { name: '相涵', glyph: '涵' },
  water: { name: '滋荣', glyph: '滋' },
};

function build(): Record<string, StarNode> {
  const nodes: Record<string, StarNode> = {};
  const add = (id: string, kind: NodeKind, el: El | null, pos: [number, number], name: string, glyph: string, mods: Mods, note?: string) => {
    nodes[id] = { id, kind, el, x: Math.round(pos[0]), y: Math.round(pos[1]), name, glyph, mods, note, links: [] };
  };
  const link = (a: string, b: string) => {
    nodes[a].links.push(b);
    nodes[b].links.push(a);
  };
  const pol = (r: number, deg: number): [number, number] => {
    const a = (deg * Math.PI) / 180;
    return [r * Math.cos(a), r * Math.sin(a)];
  };
  const lerp = (a: [number, number], b: [number, number], t: number): [number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

  add(CENTER, 'center', null, [0, 0], '太极', '极', {}, '五行散人的起点');

  GEN_ORDER.forEach((el, i) => {
    const th = -90 + 72 * i;
    const N = n(el);
    const T = THEME[el];
    const [na, nb] = NOTABLES[el];
    const k = KEYSTONES[el];
    add(`${el}.gate`, 'gate', el, pol(R_GATE, th), `${N}门`, N, { [`el.${el}`]: 0.03 }, `${N}亲和角色的起点`);
    add(`${el}.s1`, 'small', el, pol(APO, th), `${N}脉`, '', INNER[el]);
    add(`${el}.s2`, 'small', el, pol(150, th), `${N}术`, '', { [`el.${el}`]: 0.05 });
    add(`${el}.a`, 'small', el, pol(192, th - 4), `${N}术`, '', { [`el.${el}`]: 0.03, ...T });
    add(`${el}.b`, 'small', el, pol(192, th + 4), `${N}术`, '', { [`el.${el}`]: 0.03, ...T });
    add(`${el}.an`, 'notable', el, pol(234, th - 5), na.name, na.glyph, na.mods);
    add(`${el}.bn`, 'notable', el, pol(234, th + 5), nb.name, nb.glyph, nb.mods);
    add(`${el}.s3`, 'small', el, pol(272, th), `${N}术`, '', { [`el.${el}`]: 0.05 });
    add(`${el}.s4`, 'small', el, pol(306, th), `${N}术`, '', { [`el.${el}`]: 0.04, ...T });
    add(`${el}.l1`, 'small', el, pol(274, th + 9), `${N}灵根`, '', { [`lingen.${el}`]: 1 });
    add(`${el}.l2`, 'small', el, pol(310, th - 9), `${N}灵根`, '', { [`lingen.${el}`]: 1 });
    add(`${el}.k`, 'keystone', el, pol(352, th), k.name, k.glyph, { ...k.mods, [`off.${el}`]: -0.15 });
    add(`${el}.i`, 'small', null, pol(R_INNER, th + 36), '通脉', '', { dmg: 0.03 });

    link(CENTER, `${el}.gate`);
    link(`${el}.gate`, `${el}.s1`);
    link(`${el}.s1`, `${el}.s2`);
    link(`${el}.s2`, `${el}.a`);
    link(`${el}.s2`, `${el}.b`);
    link(`${el}.a`, `${el}.an`);
    link(`${el}.b`, `${el}.bn`);
    link(`${el}.an`, `${el}.s3`);
    link(`${el}.bn`, `${el}.s3`);
    link(`${el}.s3`, `${el}.s4`);
    link(`${el}.s3`, `${el}.l1`);
    link(`${el}.s4`, `${el}.l2`);
    link(`${el}.s4`, `${el}.k`);
    link(`${el}.s1`, `${el}.i`);
  });

  GEN_ORDER.forEach((el, i) => {
    const next = at(i + 1);
    const th = -90 + 72 * i;
    const I = pol(R_INNER, th + 36);
    // 通脉 → 我这一侧：破（打我克的元素）
    const prey = counters(el);
    const vMe = pol(R_STAR, th);
    add(`${el}.kc`, 'small', el, lerp(I, vMe, 0.22), `${n(el)}克${n(prey)}`, '', { [`vs.${prey}`]: 0.05 });
    add(`${el}.kt`, 'notable', el, lerp(I, vMe, 0.45), `破${n(prey)}`, '破', { [`vs.${prey}`]: 0.12 });
    // 通脉 → 邻居一侧：邻居的御（防克它的元素）
    const foe = ctrlBy(next);
    const vNext = pol(R_STAR, th + 72);
    add(`${next}.yc`, 'small', next, lerp(I, vNext, 0.22), `${n(next)}御${n(foe)}`, '', { [`res.${foe}`]: 0.04 });
    add(`${next}.yt`, 'notable', next, lerp(I, vNext, 0.45), `御${n(foe)}`, '御', { [`res.${foe}`]: 0.12 });
    link(`${el}.i`, `${el}.kc`);
    link(`${el}.kc`, `${el}.kt`);
    link(`${el}.i`, `${next}.yc`);
    link(`${next}.yc`, `${next}.yt`);
    link(`${el}.i`, `${next}.s1`);

    // 相生桥：el 生 next
    const h = HEHUA[el];
    add(`${el}.p1`, 'small', el, pol(240, th + 22), `${n(el)}术`, '', { [`el.${el}`]: 0.04 });
    add(`${el}.pn`, 'notable', null, pol(262, th + 36), `${n(el)}${n(next)}${h.name}`, h.glyph, { [`el.${el}`]: 0.06, [`el.${next}`]: 0.06, burst: 0.5 });
    add(`${el}.p2`, 'small', next, pol(240, th + 50), `${n(next)}术`, '', { [`el.${next}`]: 0.04 });
    link(`${el}.kt`, `${el}.p1`);
    link(`${el}.p1`, `${el}.pn`);
    link(`${el}.pn`, `${el}.p2`);
    link(`${el}.p2`, `${next}.yt`);
  });
  return nodes;
}

export const STAR: Record<string, StarNode> = build();

/** 合化要穴的两种颜色：母、子 */
export function hehuaEls(id: string): [El, El] | null {
  const m = /^(\w+)\.pn$/.exec(id);
  if (!m) return null;
  const el = m[1] as El;
  return [el, at(GEN_ORDER.indexOf(el) + 1)];
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
