import type { El, Terrain } from './elements';
import type { RidgeDef, SpotDef } from '../game/terrain';

export interface LevelDef {
  id: number;
  name: string;
  duration: number;
  terrain: Terrain;
  /** 敌人种类权重；from 是第几秒起才进刷怪池（普通刷怪、成群来袭、精英都从池里抽），到点时先成小群亮个相 */
  enemies: { id: string; w: number; from?: number }[];
  /** 本关地域外观：敌人 id → 贴图 key，行为不变，没写就用 enemies.ts 里的 tex。
   *  皮肤贴图必须带 `_move` 动画；`_dig`、尸骸等特殊帧缺失时回退默认贴图 */
  skins?: Record<string, string>;
  /** [秒, 每秒刷怪数, 同屏上限]，中间线性插值 */
  spawn: [number, number, number][];
  hpMult: number;
  boss: string;
  bossName: string;
  /** BGM 曲名，见 audio/tracks.ts */
  bgm: string;
  /** 过半后换成的紧张版，没有就一直用 bgm */
  bgmDanger?: string;
  ground: string;
  decor: { tex: string; w: number }[];
  decorPerChunk: number;
  /** 方形地图边长，出生点在中心 */
  size: number;
  /** 地图边缘那圈墙用的装饰贴图 */
  edge: string;
  /** 游荡精英：first 秒出第一只，之后间隔从 every[0] 线性缩到 every[1]，Boss 现身后停 */
  elites: { first: number; every: [number, number] };
  /** 岩壁：沿低频噪声的等高线排成山脊，挡住玩家和普通敌人，缺口处留出山道 */
  ridges?: RidgeDef;
  /** 落石：start 秒后开始，间隔和每次的块数从开局到结束线性插值 */
  rockfall?: { start: number; every: [number, number]; count: [number, number]; radius: number; warn: number; dmg: number };
  /**
   * 熔岩口：按格子稀疏摆在地图上，start 秒后周期喷发，每次挑玩家附近的 count 个；
   * radius 是喷发范围，warn 秒预警，喷完原地留 burn 秒余火。间隔和个数从开局到结束线性插值
   */
  lava?: SpotDef & { start: number; every: [number, number]; count: [number, number]; warn: number; dmg: number; burn: number };
  /** 煞气剑阵：按格子稀疏摆放，站在阵里的敌人护甲 +armor */
  swordZones?: SpotDef & { armor: number };
  /** Boss 现身前的远吼：每吼一次全场叠一层加成，见 RoarDef */
  roar?: RoarDef;
  lesson: string;
  available: boolean;
}

/**
 * 吼一层给敌人的加成。数值都是“每层”的量：
 * hp/speed/dmg/regen 按比例加，armor 加点数，chance 加异常几率；
 * cd 缩短冲锋、吐弹、钻地的间隔，windup 缩短冲锋蓄力，dash 加快冲刺，
 * blast 扩大自爆范围，trail 让冲刺留火多烧几秒，revive 让残兵早几秒爬起
 */
export interface RoarBuff {
  hp?: number;
  speed?: number;
  dmg?: number;
  armor?: number;
  chance?: number;
  regen?: number;
  cd?: number;
  windup?: number;
  dash?: number;
  blast?: number;
  trail?: number;
  revive?: number;
}

/**
 * Boss 远吼：times 秒各吼一次，加成对场上已有和之后刷出的普通怪、精英都生效，Boss 自己不吃。
 * buffs 先按元素取（没写的元素用 other），再叠上按敌人 id 写的那条。
 * event：吼的同时在玩家附近触发一次小范围地形事件（落石、熔岩），zoneArmor 让剑阵每层再加护甲
 */
export interface RoarDef {
  name: string;
  times: number[];
  /** 每一吼的台词，和 times 一一对应 */
  lines: string[];
  /** 第二行说明：哪些怪变强了 */
  detail: string;
  buffs: Partial<Record<El | 'other', RoarBuff>> & Record<string, RoarBuff | undefined>;
  event?: { kind: 'rockfall' | 'lava'; count: number };
  zoneArmor?: number;
}

/**
 * 难度曲线（t = 开局后的分钟数）：
 * 敌人生命 = 关卡倍率 × (1 + hpLin·t + hpQuad·t²)，后期加速，追上玩家升级和多术叠加的成长；
 * 敌人伤害 = 1 + dmgLin·t。调试面板里可以实时调。
 * 另一部分成长交给 Boss 远吼（LevelDef.roar），所以这里比纯靠时间时调低了。
 */
export const DIFF = { hpLin: 0.2, hpQuad: 0.022, dmgLin: 0.12 };

const T = (p: Partial<Record<El, number>>): Terrain => ({ metal: 0, wood: 0, water: 0, fire: 0, earth: 0, ...p });

export const LEVELS: LevelDef[] = [
  {
    id: 1, name: '荒郊古道', duration: 360,
    terrain: T({ metal: 0.2, wood: 0.2, water: 0.2, fire: 0.2, earth: 0.2 }),
    // 新手关分批教：先两种慢怪，再快追身、直线冲锋，第一波成群来袭（2:06）之后才放自爆的火鸦
    enemies: [
      { id: 'shiyong', w: 2 },
      { id: 'tengguai', w: 3 },
      { id: 'shuigui', w: 3, from: 25 },
      { id: 'tiejia', w: 1, from: 75 },
      { id: 'huoya', w: 1, from: 135 },
    ],
    spawn: [[0, 0.8, 30], [60, 1.6, 70], [120, 2.4, 110], [180, 3.4, 160], [240, 4.6, 220], [300, 3.0, 220]],
    hpMult: 1, boss: 'langyao', bossName: '狼妖', bgm: 'level1', bgmDanger: 'level1_danger',
    ground: 'ground_1',
    decor: [{ tex: 'dc_rock', w: 3 }, { tex: 'dc_tuft', w: 6 }, { tex: 'dc_tablet', w: 1 }, { tex: 'dc_deadtree', w: 1 }],
    decorPerChunk: 7,
    size: 3600, edge: 'dc_rock', elites: { first: 60, every: [55, 30] },
    // 新手关：一道稀疏的乱石带，大半是缺口
    ridges: { tex: 'dc_rock', radius: 8, bands: [0.5], scale: 620, gap: 0.56 },
    roar: {
      name: '狼啸', times: [100, 210],
      lines: ['远处传来一声狼啸……', '狼啸又近了几分……'],
      detail: '铁甲兵冲锋更快更急，水鬼更快，其余妖物更凶',
      buffs: { water: { speed: 0.1 }, other: { dmg: 0.08 }, tiejia: { windup: 0.15, dash: 0.15, cd: 0.1 } },
    },
    lesson: '新手关：留意黄色的“克”字',
    available: true,
  },
  {
    id: 2, name: '竹林', duration: 480,
    terrain: T({ earth: 0.45, water: 0.35, wood: 0.2 }),
    enemies: [{ id: 'tengguai', w: 4 }, { id: 'zhushe', w: 3 }, { id: 'shiyong', w: 2 }, { id: 'zhangchan', w: 1 }],
    skins: { shiyong: 'en_shiyong_moss' },
    spawn: [[0, 1.0, 40], [90, 2.0, 100], [180, 3.2, 160], [300, 4.6, 240], [400, 6.0, 320], [420, 3.5, 320]],
    hpMult: 1.3, boss: 'shuyao', bossName: '千年树妖', bgm: 'level2',
    ground: 'ground_2',
    decor: [{ tex: 'dc_bamboo', w: 5 }, { tex: 'dc_shoot', w: 3 }, { tex: 'dc_mossrock', w: 2 }, { tex: 'dc_fern', w: 4 }],
    decorPerChunk: 7,
    size: 3900, edge: 'dc_bamboo', elites: { first: 60, every: [60, 32] },
    // 一道密竹墙，缺口较多
    ridges: { tex: 'dc_bamboo', radius: 8, bands: [0.5], scale: 540, gap: 0.5 },
    roar: {
      name: '根须低语', times: [120, 260, 360],
      lines: ['地底的根须窸窣作响……', '千年古木在低语……', '整片竹林都在颤动……'],
      detail: '木系妖物更耐打、藤怪回血更快、竹叶青冲得更勤，其余更凶',
      buffs: { wood: { hp: 0.1, regen: 0.5 }, other: { dmg: 0.08 }, zhushe: { cd: 0.15 } },
    },
    lesson: '金克木，火借势烧木',
    available: true,
  },
  {
    id: 3, name: '山林', duration: 480,
    terrain: T({ earth: 0.7, wood: 0.2, metal: 0.1 }),
    enemies: [{ id: 'shiyong', w: 3 }, { id: 'shanxiao', w: 2 }, { id: 'chuanshan', w: 2 }, { id: 'zhangchan', w: 1 }, { id: 'tengguai', w: 2 }],
    skins: { shiyong: 'en_shiyong_rock' },
    spawn: [[0, 1.1, 45], [90, 2.2, 110], [180, 3.4, 170], [300, 4.8, 250], [400, 6.2, 330], [420, 3.6, 330]],
    hpMult: 1.6, boss: 'shanxiaowang', bossName: '山魈王', bgm: 'level3',
    ground: 'ground_3',
    decor: [{ tex: 'dc_pine', w: 4 }, { tex: 'dc_mossrock', w: 3 }, { tex: 'dc_rock', w: 2 }, { tex: 'dc_fern', w: 3 }, { tex: 'dc_tuft', w: 3 }],
    decorPerChunk: 7,
    size: 4200, edge: 'dc_cliff', elites: { first: 60, every: [60, 32] },
    // 两道岩壁，比竹林密，但山道缺口宽、隔得不远
    ridges: { tex: 'dc_cliff', radius: 11, bands: [0.4, 0.6], scale: 560, gap: 0.56 },
    rockfall: { start: 20, every: [7, 3.5], count: [1, 3], radius: 20, warn: 1.1, dmg: 12 },
    roar: {
      name: '山吼', times: [120, 260, 360],
      lines: ['山那边传来捶胸的闷响……', '山吼震得碎石直落……', '群山都在回应山魈王……'],
      detail: '土系妖物更硬、投石钻地更勤、更容易震慑，其余更凶',
      buffs: { earth: { armor: 1, cd: 0.15, chance: 0.1 }, other: { dmg: 0.08 } },
      event: { kind: 'rockfall', count: 3 },
    },
    lesson: '顺地气：土生金，金很舒服；山道窄，留意头顶落石',
    available: true,
  },
  {
    id: 4, name: '赤焰谷', duration: 600,
    terrain: T({ fire: 0.6, earth: 0.3, metal: 0.1 }),
    // 火 70%、土 30%
    enemies: [{ id: 'huoya', w: 3 }, { id: 'chihu', w: 2 }, { id: 'huojing', w: 2 }, { id: 'shiyong', w: 3 }],
    skins: { shiyong: 'en_shiyong_lava' },
    spawn: [[0, 1.2, 50], [90, 2.3, 120], [200, 3.6, 190], [340, 5.0, 270], [480, 6.4, 350], [540, 3.8, 350]],
    hpMult: 2.0, boss: 'bifang', bossName: '毕方', bgm: 'level4',
    ground: 'ground_4',
    decor: [{ tex: 'dc_scorch', w: 3 }, { tex: 'dc_cinder', w: 5 }, { tex: 'dc_rock', w: 2 }, { tex: 'dc_tuft', w: 2 }],
    decorPerChunk: 6,
    size: 4400, edge: 'dc_basalt', elites: { first: 60, every: [60, 30] },
    // 两道玄武岩壁夹出谷道，缺口比山林多一点：熔岩已经够逼走位
    ridges: { tex: 'dc_basalt', radius: 11, bands: [0.4, 0.6], scale: 600, gap: 0.6 },
    lava: { cell: 340, chance: 0.55, radius: 30, start: 20, every: [8, 4], count: [1, 3], warn: 1.3, dmg: 14, burn: 3 },
    roar: {
      name: '凤鸣', times: [150, 320, 450],
      lines: ['谷中传来一声凤鸣……', '凤鸣声越来越近……', '整座赤焰谷都烧了起来……'],
      detail: '火系妖物爆得更大、留火更久、吐火更勤，熔壳石俑更硬',
      // 火生土：熔壳石俑越烧越硬
      buffs: { fire: { blast: 0.2, trail: 1, cd: 0.15, chance: 0.1 }, other: { dmg: 0.08 }, shiyong: { armor: 2 } },
      event: { kind: 'lava', count: 2 },
    },
    lesson: '逆风关：火克金，剑客要补水或土；熔岩口发亮就快走',
    available: true,
  },
  {
    id: 5, name: '兵冢古战场', duration: 600,
    terrain: T({ metal: 0.6, earth: 0.25, fire: 0.15 }),
    // 金 75%、土 25%
    enemies: [{ id: 'canbing', w: 4 }, { id: 'tiejia', w: 2 }, { id: 'feilian', w: 1.5 }, { id: 'shiyong', w: 1.5 }, { id: 'chuanshan', w: 1 }],
    skins: { shiyong: 'en_shiyong_armor' },
    spawn: [[0, 1.2, 50], [90, 2.4, 125], [200, 3.7, 200], [340, 5.1, 280], [480, 6.5, 360], [540, 3.9, 360]],
    hpMult: 2.4, boss: 'xingtian', bossName: '刑天', bgm: 'level5',
    ground: 'ground_5',
    decor: [{ tex: 'dc_sword', w: 4 }, { tex: 'dc_bones', w: 3 }, { tex: 'dc_tablet', w: 2 }, { tex: 'dc_deadtree', w: 2 }, { tex: 'dc_tuft', w: 3 }],
    decorPerChunk: 6,
    size: 4600, edge: 'dc_barricade', elites: { first: 60, every: [60, 30] },
    // 一道拒马残垒
    ridges: { tex: 'dc_barricade', radius: 9, bands: [0.5], scale: 560, gap: 0.55 },
    swordZones: { cell: 420, chance: 0.5, radius: 64, armor: 3 },
    roar: {
      name: '战鼓', times: [150, 320, 450],
      lines: ['古战场深处擂起了战鼓……', '鼓声更急了……', '干戚相击，战鼓如雷……'],
      detail: '金系冲锋、甩刃更勤，残兵爬起更快，剑阵护甲再加一层，其余更凶',
      buffs: { metal: { cd: 0.15, dash: 0.15 }, other: { dmg: 0.08 }, canbing: { revive: 0.8 } },
      zoneArmor: 1,
    },
    lesson: '用火终结复活的残兵；煞气剑阵里的敌人护甲 +3，引出来打',
    available: true,
  },
  // 以下关卡在后续阶段开放，先占位用于选关界面。第 7 关起混合元素
  ...([
    [6, '云梦泽', 600, T({ water: 0.7, earth: 0.2, wood: 0.1 }), '相柳', '三个角色都打不顺'],
    [7, '寒江', 720, T({ water: 0.55, metal: 0.35, earth: 0.1 }), '玄冥', '冰面滑行'],
    [8, '大漠', 720, T({ earth: 0.6, metal: 0.3, fire: 0.1 }), '旱魃', '双修：一种元素顾不过来'],
    [9, '东海归墟', 720, T({ water: 0.5, fire: 0.3, earth: 0.2 }), '九婴', '答案是土'],
    [10, '昆仑', 900, T({ metal: 0.2, wood: 0.2, water: 0.2, fire: 0.2, earth: 0.2 }), '帝江', '期末考'],
  ] as const).map(([id, name, duration, terrain, bossName, lesson]): LevelDef => ({
    id, name, duration, terrain, bossName, lesson,
    enemies: [], spawn: [], hpMult: 1, boss: '', bgm: 'level1', ground: 'ground_1', decor: [], decorPerChunk: 0,
    size: 3600, edge: 'dc_rock', elites: { first: 60, every: [55, 30] },
    available: false,
  })),
];

/** t 秒时可以刷的敌人；配置写错导致一个都没到点时退回第一种，不让刷怪断掉 */
export function enemyPool(level: Pick<LevelDef, 'enemies'>, t: number) {
  const pool = level.enemies.filter((e) => (e.from ?? 0) <= t);
  return pool.length ? pool : level.enemies.slice(0, 1);
}

/** 远吼每层给这种敌人的加成：元素那条（没有就用 other）再叠上按 id 写的那条；没配远吼返回 null */
export function roarBuff(level: Pick<LevelDef, 'roar'>, defId: string, el: El): RoarBuff | null {
  const b = level.roar?.buffs;
  if (!b) return null;
  return { ...(b[el] ?? b.other), ...b[defId] };
}

/** 本关该用的敌人贴图：配了地域外观就用它，否则用敌人默认贴图 */
export function enemyTex(level: Pick<LevelDef, 'skins'>, defId: string, fallback: string) {
  return level.skins?.[defId] ?? fallback;
}
