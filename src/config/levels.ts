import type { El, Terrain } from './elements';
import type { Tier, Trick } from './enemies';
import type { RidgeDef, SpotDef } from '../game/terrain';

/** 风暴外观：暴风雪、沙暴 */
export type StormLook = 'snow' | 'sand';

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
  rockfall?: { start: number; every: [number, number]; count: [number, number]; radius: number; warn: number; dmg: number; phase?: El };
  /**
   * 熔岩口：按格子稀疏摆在地图上，start 秒后周期喷发，每次挑玩家附近的 count 个；
   * radius 是喷发范围，warn 秒预警，喷完原地留 burn 秒余火。间隔和个数从开局到结束线性插值；hint 换掉第一次喷发的提示
   */
  lava?: SpotDef & { start: number; every: [number, number]; count: [number, number]; warn: number; dmg: number; burn: number; hint?: string };
  /** 煞气剑阵：按格子稀疏摆放，站在阵里的敌人护甲 +armor */
  swordZones?: SpotDef & { armor: number };
  /** 泥潭：按格子稀疏摆放的贴地椭圆，玩家移速乘 player，非水系的普通敌人移速乘 enemy；tex 换贴图（不配是泥沼 + 香蒲） */
  mud?: SpotDef & { player: number; enemy: number; tex?: string };
  /**
   * 瘴雾：start 秒后周期从玩家附近的 count 个泥潭里冒出，grow 秒内从小慢慢扩到半径 radius，共存在 life 秒。
   * 雾里的玩家每 tick 秒按 chance 中毒（每秒 dps，乘伤害成长），非木系的普通敌人每次掉 enemy 比例的生命。间隔和个数从开局到结束线性插值
   */
  miasma?: { start: number; every: [number, number]; count: [number, number]; radius: number; grow: number; life: number; tick: number; chance: number; dps: number; enemy: number; phase?: El };
  /**
   * 冰面：按格子稀疏摆放的贴地椭圆。玩家在冰上有惯性：速度每秒按 grip 的速率追向想走的方向（越小越滑），
   * 滑起来最快到 boost 倍；非水系的普通敌人移速乘 enemy
   */
  ice?: SpotDef & { grip: number; boost: number; enemy: number };
  /**
   * 相位轮转（东海归墟的涨退潮、昆仑的五气当令）：按 order 依次换相，每相持续 every 秒（从开局到结束线性插值，cycle.rage 为真时 Boss 狂暴后减半），
   * 换相前 warn 秒预警（warn 文本按下一相取）。每相地气换成 terrain 里那一套（没配就按 phaseTerrain 生成：当相 60%、其余各 10%）；
   * 当相元素的普通妖物移速乘 surge、刷怪权重乘 weight；带 phase 的点位、落石、瘴雾只在那一相起作用。
   * note 跟在 HUD 地气行后面，start 是换到这一相时的提示；banner 为真时换相全屏预警
   */
  cycle?: {
    order: El[];
    every: [number, number];
    warn: number;
    surge: number;
    weight: number;
    terrain?: Partial<Record<El, Terrain>>;
    note: Partial<Record<El, string>>;
    start: Partial<Record<El, string>>;
    warnText: Partial<Record<El, string>>;
    banner?: boolean;
    rage?: boolean;
  };
  /**
   * 流沙：按格子稀疏摆放的贴地椭圆。玩家移速乘 player，并每秒往中心吸 pull 像素；陷到中心（半径的 core 以内）
   * 每 tick 秒受 dmg 土伤（乘伤害成长）、一半几率攒震慑。非土系的普通敌人移速乘 enemy
   */
  quicksand?: SpotDef & { player: number; enemy: number; pull: number; core: number; tick: number; dmg: number };
  /**
   * 风暴（寒江的暴风雪、大漠的沙暴，look 决定外观和提示）：start 秒后周期刮起，先预警 warn 秒，再刮 dur 秒
   * （间隔和时长从开局到结束线性插值）。期间视野只剩玩家周围半径 vision，风朝一个方向每秒推玩家 wind 像素；
   * boost：刮的时候玩家这一系的术伤害乘 1 + amt（沙暴里金气更盛）
   */
  storm?: { look: StormLook; start: number; every: [number, number]; dur: [number, number]; warn: number; vision: number; wind: number; boost?: { el: El; amt: number } };
  /** 本关给哪些敌人开哪些手段（见 config/enemies.ts 的 Trick）；前几关不配，敌人保持最朴素的打法 */
  tricks?: Record<string, Trick[]>;
  /** 本关精英随机带几个词缀（见 Affix），不配为 0 */
  eliteAffixes?: number;
  /**
   * 小怪升阶：[第几秒开始出现, Boss 现身时的占比]，中间线性涨。先按三阶的占比掷，没中再掷二阶。
   * 只管普通刷怪和成群来袭，新怪亮相、精英、召唤物都是一阶
   */
  tiers?: Partial<Record<2 | 3, [number, number]>>;
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
 * event：吼的同时在玩家附近触发一次小范围地形事件（落石、熔岩、瘴雾、一阵短风暴），zoneArmor 让剑阵每层再加护甲
 */
export interface RoarDef {
  name: string;
  times: number[];
  /** 每一吼的台词，和 times 一一对应 */
  lines: string[];
  /** 第二行说明：哪些怪变强了 */
  detail: string;
  buffs: Partial<Record<El | 'other', RoarBuff>> & Record<string, RoarBuff | undefined>;
  /** count：落石块数、熔岩口个数、瘴雾处数；风暴是刮几秒；相位不看 count，立刻换到下一相 */
  event?: { kind: 'rockfall' | 'lava' | 'miasma' | 'storm' | 'phase'; count: number };
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
    skins: { shiyong: 'en_shiyong_moss', tengguai: 'en_tengguai_grove' },
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
    skins: { shiyong: 'en_shiyong_rock', tengguai: 'en_tengguai_grove' },
    spawn: [[0, 1.1, 45], [90, 2.2, 110], [180, 3.4, 170], [300, 4.8, 250], [400, 6.2, 330], [420, 3.6, 330]],
    hpMult: 1.6, boss: 'shanxiaowang', bossName: '山魈王', bgm: 'level3',
    ground: 'ground_3',
    decor: [{ tex: 'dc_pine', w: 4 }, { tex: 'dc_mossrock', w: 3 }, { tex: 'dc_rock', w: 2 }, { tex: 'dc_fern', w: 3 }, { tex: 'dc_tuft', w: 3 }],
    decorPerChunk: 7,
    size: 4200, edge: 'dc_cliff', elites: { first: 60, every: [60, 32] },
    // 两道岩壁，比竹林密，但山道缺口宽、隔得不远
    ridges: { tex: 'dc_cliff', radius: 11, bands: [0.4, 0.6], scale: 560, gap: 0.56 },
    rockfall: { start: 20, every: [7, 3.5], count: [1, 3], radius: 20, warn: 1.1, dmg: 12 },
    // 后半程才零星出现凶
    tiers: { 2: [240, 0.12] },
    roar: {
      name: '山吼', times: [120, 260, 360],
      lines: ['山那边传来捶胸的闷响……', '山吼震得碎石直落……', '群山都在回应山魈王……'],
      detail: '土系妖物更硬、投石钻地更勤、更容易震慑，其余更凶',
      buffs: { earth: { armor: 1, cd: 0.15, chance: 0.05 }, other: { dmg: 0.08 } },
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
    skins: { shiyong: 'en_shiyong_lava', huoya: 'en_huoya_ember' },
    spawn: [[0, 1.2, 50], [90, 2.3, 120], [200, 3.6, 190], [340, 5.0, 270], [480, 6.4, 350], [540, 3.8, 350]],
    hpMult: 2.0, boss: 'bifang', bossName: '毕方', bgm: 'level4',
    ground: 'ground_4',
    decor: [{ tex: 'dc_scorch', w: 3 }, { tex: 'dc_cinder', w: 5 }, { tex: 'dc_rock', w: 2 }, { tex: 'dc_tuft', w: 2 }],
    decorPerChunk: 6,
    size: 4400, edge: 'dc_basalt', elites: { first: 60, every: [60, 30] },
    // 两道玄武岩壁夹出谷道，缺口比山林多一点：熔岩已经够逼走位
    ridges: { tex: 'dc_basalt', radius: 11, bands: [0.4, 0.6], scale: 600, gap: 0.6 },
    lava: { cell: 340, chance: 0.55, radius: 30, start: 20, every: [8, 4], count: [1, 3], warn: 1.3, dmg: 14, burn: 3 },
    // 从这关起敌人开始有花样：火精的火球落地留余火，熔壳石俑贴身震地；精英带一个词缀
    tricks: { huojing: ['lob'], shiyong: ['quake'] },
    eliteAffixes: 1,
    tiers: { 2: [150, 0.25] },
    roar: {
      name: '凤鸣', times: [150, 320, 450],
      lines: ['谷中传来一声凤鸣……', '凤鸣声越来越近……', '整座赤焰谷都烧了起来……'],
      detail: '火系妖物爆得更大、留火更久、吐火更勤，熔壳石俑更硬',
      // 火生土：熔壳石俑越烧越硬
      buffs: { fire: { blast: 0.2, trail: 1, cd: 0.15, chance: 0.05 }, other: { dmg: 0.08 }, shiyong: { armor: 2 } },
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
    skins: { shiyong: 'en_shiyong_armor', chuanshan: 'en_chuanshan_armor' },
    spawn: [[0, 1.2, 50], [90, 2.4, 125], [200, 3.7, 200], [340, 5.1, 280], [480, 6.5, 360], [540, 3.9, 360]],
    hpMult: 2.4, boss: 'xingtian', bossName: '刑天', bgm: 'level5',
    ground: 'ground_5',
    decor: [{ tex: 'dc_sword', w: 4 }, { tex: 'dc_bones', w: 3 }, { tex: 'dc_tablet', w: 2 }, { tex: 'dc_deadtree', w: 2 }, { tex: 'dc_tuft', w: 3 }],
    decorPerChunk: 6,
    size: 4600, edge: 'dc_barricade', elites: { first: 60, every: [60, 30] },
    // 一道拒马残垒
    ridges: { tex: 'dc_barricade', radius: 9, bands: [0.5], scale: 560, gap: 0.55 },
    swordZones: { cell: 420, chance: 0.5, radius: 64, armor: 3 },
    // 铁甲兵列阵给周围加护甲，石俑照样震地
    tricks: { tiejia: ['formation'], shiyong: ['quake'] },
    eliteAffixes: 1,
    tiers: { 2: [120, 0.3], 3: [420, 0.08] },
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
  {
    id: 6, name: '云梦泽', duration: 600,
    terrain: T({ water: 0.7, earth: 0.2, wood: 0.1 }),
    // 水 70%、木 30%：水生木，水系一多木系也跟着旺；剑客、符师、海贼都打不顺，要补土或木
    enemies: [{ id: 'shuigui', w: 3 }, { id: 'yuyao', w: 2 }, { id: 'jiao', w: 2 }, { id: 'tengguai', w: 2 }, { id: 'zhushe', w: 1 }],
    skins: { shuigui: 'en_shuigui_marsh', tengguai: 'en_tengguai_grove' },
    spawn: [[0, 1.3, 55], [90, 2.5, 130], [200, 3.8, 205], [340, 5.2, 285], [480, 6.6, 365], [540, 4.0, 365]],
    hpMult: 2.8, boss: 'xiangliu', bossName: '相柳', bgm: 'level6',
    ground: 'ground_6',
    decor: [{ tex: 'dc_cattail', w: 4 }, { tex: 'dc_lotus', w: 4 }, { tex: 'dc_deadtree', w: 2 }, { tex: 'dc_mossrock', w: 2 }, { tex: 'dc_fern', w: 2 }],
    decorPerChunk: 6,
    size: 4800, edge: 'dc_reed', elites: { first: 60, every: [60, 30] },
    // 一道芦苇荡，缺口不少：泥潭和瘴雾已经够逼走位
    ridges: { tex: 'dc_reed', radius: 9, bands: [0.5], scale: 600, gap: 0.56 },
    mud: { cell: 300, chance: 0.6, radius: 48, player: 0.65, enemy: 0.6 },
    miasma: { start: 30, every: [14, 8], count: [1, 2], radius: 80, grow: 6, life: 16, tick: 0.7, chance: 0.6, dps: 2, enemy: 0.05 },
    // 鱼妖的水弹落地留水洼，藤怪在玩家脚下催生缠根；精英带两个词缀
    tricks: { yuyao: ['lob'], tengguai: ['roots'] },
    eliteAffixes: 2,
    tiers: { 2: [90, 0.35], 3: [300, 0.15] },
    roar: {
      name: '泽啸', times: [150, 320, 450],
      lines: ['大泽深处传来九声嘶鸣……', '雾里九个脑袋若隐若现……', '整片云梦泽都翻涌起来……'],
      detail: '水系妖物吐得更勤、更快、更容易迟缓，蛟的水洼更久，木系更耐打，其余更凶',
      // 水生木：木系越泡越壮
      buffs: { water: { cd: 0.15, speed: 0.08, chance: 0.05, trail: 1 }, wood: { hp: 0.12 }, other: { dmg: 0.08 } },
      event: { kind: 'miasma', count: 2 },
    },
    lesson: '三个初始角色都打不顺：补土或木；别站泥潭，把怪引进瘴雾',
    available: true,
  },
  {
    id: 7, name: '寒江', duration: 720,
    terrain: T({ water: 0.55, metal: 0.35, earth: 0.1 }),
    // 水 50%、金 50%：海贼打金顺手、打水平平，剑客两头吃亏，符师打金猛、打水被克；补土（克水）或火（克金）
    enemies: [{ id: 'shuigui', w: 3 }, { id: 'bingcan', w: 2 }, { id: 'yuyao', w: 1.5 }, { id: 'tiejia', w: 2 }, { id: 'aoxie', w: 2 }, { id: 'feilian', w: 2 }],
    skins: { shuigui: 'en_shuigui_marsh' },
    spawn: [[0, 1.3, 60], [90, 2.6, 135], [220, 3.9, 210], [380, 5.3, 290], [540, 6.8, 370], [660, 4.2, 370]],
    hpMult: 3.3, boss: 'xuanming', bossName: '玄冥', bgm: 'level7',
    ground: 'ground_7',
    decor: [{ tex: 'dc_snowpine', w: 3 }, { tex: 'dc_icerock', w: 3 }, { tex: 'dc_snowtuft', w: 5 }, { tex: 'dc_deadtree', w: 1 }],
    decorPerChunk: 6,
    size: 5000, edge: 'dc_icecliff', elites: { first: 60, every: [60, 30] },
    // 一道冰崖，缺口比芦苇荡少一点：冰上滑起来要找准山道
    ridges: { tex: 'dc_icecliff', radius: 9, bands: [0.5], scale: 640, gap: 0.5 },
    ice: { cell: 320, chance: 0.6, radius: 66, grip: 2.2, boost: 1.2, enemy: 0.7 },
    storm: { look: 'snow', start: 60, every: [55, 38], dur: [10, 15], warn: 2.5, vision: 120, wind: 22 },
    // 鱼妖照旧抛射留水洼，铁甲兵列阵，飞镰的刃会折回来；精英带两个词缀（第 7 关起有寒）
    tricks: { yuyao: ['lob'], tiejia: ['formation'], feilian: ['boomerang'] },
    eliteAffixes: 2,
    tiers: { 2: [60, 0.4], 3: [240, 0.2] },
    roar: {
      name: '北风号', times: [150, 330, 480],
      lines: ['江面尽头刮来一阵怪风……', '风里夹着羽翼拍打的声音……', '北风怒号，玄冥将至……'],
      detail: '水系妖物吐得更勤、更快、更容易迟缓，其余更凶；每一吼都刮一阵暴风雪',
      buffs: { water: { cd: 0.15, speed: 0.08, chance: 0.05, trail: 1 }, other: { dmg: 0.08 } },
      event: { kind: 'storm', count: 6 },
    },
    lesson: '冰上走位要留提前量；暴风雪里看不远，贴着冰崖和缺口走',
    available: true,
  },
  {
    id: 8, name: '大漠', duration: 720,
    terrain: T({ earth: 0.6, metal: 0.3, fire: 0.1 }),
    // 土 50%、金 40%、火 10%：土生金，一种元素顾不过来两类敌人；木克土、火克金，双修最顺
    enemies: [
      { id: 'shiyong', w: 2 }, { id: 'shaxie', w: 2.5 }, { id: 'chuanshan', w: 1.5 }, { id: 'shanxiao', w: 1 },
      { id: 'tiejia', w: 1.5 }, { id: 'jinqiang', w: 2 }, { id: 'feilian', w: 1.5 }, { id: 'chihu', w: 1 },
    ],
    skins: { shiyong: 'en_shiyong_rock' },
    spawn: [[0, 1.4, 62], [90, 2.7, 140], [220, 4.0, 215], [380, 5.4, 295], [540, 6.9, 375], [660, 4.3, 375]],
    hpMult: 3.9, boss: 'hanba', bossName: '旱魃', bgm: 'level8',
    ground: 'ground_8',
    decor: [{ tex: 'dc_poplar', w: 2 }, { tex: 'dc_sandrock', w: 3 }, { tex: 'dc_camelthorn', w: 5 }, { tex: 'dc_bones', w: 1 }],
    decorPerChunk: 5,
    size: 5200, edge: 'dc_yardang', elites: { first: 60, every: [60, 30] },
    // 一道雅丹土台，缺口不少：流沙和沙暴已经够逼走位
    ridges: { tex: 'dc_yardang', radius: 9, bands: [0.5], scale: 660, gap: 0.54 },
    quicksand: { cell: 340, chance: 0.55, radius: 56, player: 0.75, enemy: 0.6, pull: 26, core: 0.35, tick: 0.8, dmg: 3 },
    storm: { look: 'sand', start: 75, every: [60, 40], dur: [10, 14], warn: 2.5, vision: 135, wind: 26, boost: { el: 'metal', amt: 0.15 } },
    // 石俑震地、铁甲兵列阵、飞镰回旋，穿山甲破土留流沙；精英带两个词缀
    tricks: { shiyong: ['quake'], tiejia: ['formation'], feilian: ['boomerang'], chuanshan: ['sinkhole'] },
    eliteAffixes: 2,
    tiers: { 2: [60, 0.45], 3: [210, 0.25] },
    roar: {
      name: '旱雷', times: [150, 330, 480],
      lines: ['大漠深处滚过一声干雷……', '地面龟裂，热气蒸腾……', '赤地千里，旱魃将至……'],
      detail: '土系妖物出招更勤、护甲更厚、更容易震慑，金系更耐打，其余更凶；每一吼都刮一阵沙暴',
      // 土生金：金系越晒越硬
      buffs: { earth: { cd: 0.15, armor: 1, chance: 0.05 }, metal: { hp: 0.12 }, other: { dmg: 0.08 } },
      event: { kind: 'storm', count: 6 },
    },
    lesson: '双修：土系用木打、金系用火打；旱魃半血化火，换水克它；别陷进流沙中心',
    available: true,
  },
  {
    id: 9, name: '东海归墟', duration: 720,
    terrain: T({ water: 0.5, fire: 0.3, earth: 0.2 }),
    // 水 50%、火 50%：两系互克，金木火水都只占一头的便宜；土打水 ×1.5、打火 ×1.2，是唯一两头都顺的答案
    enemies: [
      { id: 'shuigui', w: 2.5 }, { id: 'yuyao', w: 1.5 }, { id: 'jiao', w: 1.5 }, { id: 'yecha', w: 2 },
      { id: 'huoya', w: 2 }, { id: 'huojing', w: 1.5 }, { id: 'chihu', w: 1.5 }, { id: 'yanshao', w: 2 },
    ],
    skins: { shuigui: 'en_shuigui_marsh', huoya: 'en_huoya_ember' },
    spawn: [[0, 1.5, 65], [90, 2.8, 145], [220, 4.1, 220], [380, 5.5, 300], [540, 7.0, 380], [660, 4.4, 380]],
    hpMult: 4.5, boss: 'jiuying', bossName: '九婴', bgm: 'level9',
    ground: 'ground_9',
    decor: [{ tex: 'dc_kelp', w: 3 }, { tex: 'dc_shell', w: 4 }, { tex: 'dc_basalt', w: 1 }, { tex: 'dc_bones', w: 1 }],
    decorPerChunk: 5,
    size: 5400, edge: 'dc_coral', elites: { first: 60, every: [60, 30] },
    // 一道珊瑚礁
    ridges: { tex: 'dc_coral', radius: 9, bands: [0.5], scale: 680, gap: 0.54 },
    // 浅滩涨潮才积水，海底火山口退潮才喷
    mud: { cell: 300, chance: 0.5, radius: 50, player: 0.7, enemy: 0.65, tex: 'dc_tidepool', phase: 'water' },
    lava: { cell: 360, chance: 0.5, radius: 30, start: 0, every: [8, 4.5], count: [1, 3], warn: 1.3, dmg: 14, burn: 3, phase: 'fire', hint: '海底火山口要喷发了！发亮的地方快离开' },
    cycle: {
      order: ['water', 'fire'], every: [50, 35], warn: 4, surge: 1.15, weight: 2, rage: true,
      terrain: { water: T({ water: 0.7, fire: 0.1, earth: 0.2 }), fire: T({ water: 0.2, fire: 0.6, earth: 0.2 }) },
      note: { water: '涨潮', fire: '退潮' },
      start: { water: '涨潮了！浅滩积水，水系妖物更凶；地气偏水', fire: '退潮了！海底火山口苏醒，火系妖物更凶；地气偏火' },
      warnText: { fire: '潮水开始退了……海底在发烫', water: '远处传来潮声，海水要涨了……' },
    },
    // 鱼妖、火精照旧抛射，落地留水洼、余火
    tricks: { yuyao: ['lob'], huojing: ['lob'] },
    eliteAffixes: 2,
    tiers: { 2: [50, 0.5], 3: [180, 0.3] },
    roar: {
      name: '婴啼', times: [150, 330, 480],
      lines: ['海底传来婴儿般的啼哭……', '啼声九重，海水忽冷忽热……', '归墟翻涌，九婴将至……'],
      detail: '水系妖物吐得更勤、更快、更容易迟缓，其余更凶；每一声啼哭都让潮水立刻翻转',
      buffs: { water: { cd: 0.15, speed: 0.08, chance: 0.05, trail: 1 }, other: { dmg: 0.08 } },
      event: { kind: 'phase', count: 0 },
    },
    lesson: '双克制：答案是土（打水 ×1.5、打火 ×1.2）；涨潮躲浅滩，退潮躲火山口',
    available: true,
  },
  {
    id: 10, name: '昆仑', duration: 900,
    terrain: T({ metal: 0.2, wood: 0.2, water: 0.2, fire: 0.2, earth: 0.2 }),
    // 期末考：五系小怪全来，按相生每 3 分钟换一气当令，当令那一系刷得多、跑得快；轮转流跟着换本命，专精流靠克制硬打
    enemies: [
      { id: 'tengguai', w: 2 }, { id: 'zhushe', w: 1.5 },
      { id: 'huoya', w: 1.5 }, { id: 'huojing', w: 1 }, { id: 'chihu', w: 1 }, { id: 'yanshao', w: 1 },
      { id: 'shiyong', w: 1.5 }, { id: 'shaxie', w: 1.5 }, { id: 'chuanshan', w: 1 },
      { id: 'tiejia', w: 1.5 }, { id: 'feilian', w: 1 }, { id: 'aoxie', w: 1 }, { id: 'jinqiang', w: 1 },
      { id: 'shuigui', w: 1.5 }, { id: 'yuyao', w: 1 }, { id: 'bingcan', w: 1 }, { id: 'yecha', w: 1 },
    ],
    skins: { tengguai: 'en_tengguai_grove', huoya: 'en_huoya_ember', shiyong: 'en_shiyong_rock', shuigui: 'en_shuigui_marsh' },
    spawn: [[0, 1.6, 70], [120, 3.0, 150], [300, 4.4, 230], [480, 5.8, 310], [660, 7.2, 390], [840, 4.6, 390]],
    hpMult: 5.2, boss: 'dijiang', bossName: '帝江', bgm: 'level10',
    ground: 'ground_10',
    decor: [{ tex: 'dc_pine', w: 2 }, { tex: 'dc_mossrock', w: 2 }, { tex: 'dc_tablet', w: 1 }, { tex: 'dc_tuft', w: 4 }, { tex: 'dc_icerock', w: 2 }],
    decorPerChunk: 5,
    size: 5600, edge: 'dc_kunlun', elites: { first: 60, every: [55, 28] },
    // 一道昆仑玉崖
    ridges: { tex: 'dc_kunlun', radius: 9, bands: [0.5], scale: 700, gap: 0.54 },
    // 五气各管一种地形：木气毒沼冒瘴雾、火气熔岩口喷发、土气落石、金气剑阵加甲、水气冰面
    mud: { cell: 320, chance: 0.4, radius: 46, player: 0.7, enemy: 0.65, phase: 'wood' },
    miasma: { start: 0, every: [12, 8], count: [1, 2], radius: 70, grow: 5, life: 14, tick: 0.7, chance: 0.5, dps: 2, enemy: 0.05, phase: 'wood' },
    lava: { cell: 380, chance: 0.45, radius: 30, start: 0, every: [8, 5], count: [1, 3], warn: 1.3, dmg: 14, burn: 3, phase: 'fire' },
    rockfall: { start: 0, every: [6, 3.5], count: [1, 3], radius: 20, warn: 1.1, dmg: 12, phase: 'earth' },
    swordZones: { cell: 440, chance: 0.45, radius: 64, armor: 3, phase: 'metal' },
    ice: { cell: 340, chance: 0.5, radius: 60, grip: 2.2, boost: 1.2, enemy: 0.7, phase: 'water' },
    cycle: {
      order: ['wood', 'fire', 'earth', 'metal', 'water'], every: [180, 180], warn: 8, surge: 1.1, weight: 3, banner: true,
      note: { wood: '木气当令', fire: '火气当令', earth: '土气当令', metal: '金气当令', water: '水气当令' },
      start: {
        wood: '木气当令：毒沼冒瘴雾，木系妖物更凶；金克木',
        fire: '火气当令：熔岩口喷发，火系妖物更凶；水克火',
        earth: '土气当令：山上落石，土系妖物更凶；木克土',
        metal: '金气当令：剑阵加甲，金系妖物更凶；火克金',
        water: '水气当令：冰面打滑，水系妖物更凶；土克水',
      },
      warnText: {
        wood: '灵气流转，木气将盛……',
        fire: '灵气流转，火气将盛……',
        earth: '灵气流转，土气将盛……',
        metal: '灵气流转，金气将盛……',
        water: '灵气流转，水气将盛……',
      },
    },
    // 前几关的手段全开；精英带三个词缀
    tricks: { shiyong: ['quake'], tiejia: ['formation'], tengguai: ['roots'], yuyao: ['lob'], huojing: ['lob'], feilian: ['boomerang'], chuanshan: ['sinkhole'] },
    eliteAffixes: 3,
    tiers: { 2: [40, 0.55], 3: [150, 0.35] },
    roar: {
      name: '帝江歌', times: [200, 420, 640],
      lines: ['昆仑之巅传来歌声，不知从何而起……', '歌声里夹着六足踏地的舞步……', '混沌起舞，帝江将至……'],
      detail: '土系妖物出招更勤、护甲更厚，金系更耐打，其余更凶',
      buffs: { earth: { cd: 0.15, armor: 1 }, metal: { hp: 0.12 }, other: { dmg: 0.08 } },
    },
    lesson: '期末考：看清当令的元素再选术；轮转流跟着五气换本命，专精流靠克制硬打',
    available: true,
  },
];

/**
 * 临时地形（玄冥冰锥、旱魃陷沙、穿山甲陷坑留下的）在没配固定冰面 / 流沙的关卡用的参数；
 * 配了就沿用本关的 ice / quicksand，只是半径、时长由留下它的招决定
 */
export const TEMP_TERRAIN: { ice: NonNullable<LevelDef['ice']>; sand: NonNullable<LevelDef['quicksand']> } = {
  ice: { cell: 320, chance: 0, radius: 30, grip: 2.2, boost: 1.2, enemy: 0.7 },
  sand: { cell: 340, chance: 0, radius: 40, player: 0.75, enemy: 0.6, pull: 26, core: 0.35, tick: 0.8, dmg: 3 },
};

/** 这一相的地气：配了就用配的，否则当相元素 60%、其余各 10% */
export function phaseTerrain(level: Pick<LevelDef, 'cycle'>, el: El): Terrain {
  return level.cycle?.terrain?.[el] ?? T({ metal: 0.1, wood: 0.1, water: 0.1, fire: 0.1, earth: 0.1, [el]: 0.6 });
}

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

/** t 秒时这一阶的占比：from 前为 0，到 Boss 现身（duration − 60）时涨到 max，之后保持 */
export function tierShare(level: Pick<LevelDef, 'tiers' | 'duration'>, tier: 2 | 3, t: number): number {
  const c = level.tiers?.[tier];
  if (!c || t < c[0]) return 0;
  const end = Math.max(c[0] + 1, level.duration - 60);
  return c[1] * Math.min(1, (t - c[0]) / (end - c[0]));
}

/** 掷这只新刷的小怪是几阶 */
export function rollTier(level: Pick<LevelDef, 'tiers' | 'duration'>, t: number, R: () => number = Math.random): Tier {
  if (R() < tierShare(level, 3, t)) return 3;
  if (R() < tierShare(level, 2, t)) return 2;
  return 1;
}

const NO_TRICKS: Trick[] = [];

/** 本关这种敌人开了哪些手段 */
export function tricksOf(level: Pick<LevelDef, 'tricks'>, defId: string): Trick[] {
  return level.tricks?.[defId] ?? NO_TRICKS;
}

/** 本关该用的敌人贴图：配了地域外观就用它，否则用敌人默认贴图 */
export function enemyTex(level: Pick<LevelDef, 'skins'>, defId: string, fallback: string) {
  return level.skins?.[defId] ?? fallback;
}
