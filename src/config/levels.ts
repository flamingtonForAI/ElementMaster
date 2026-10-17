import type { El, Terrain } from './elements';
import type { RidgeDef } from '../game/terrain';

export interface LevelDef {
  id: number;
  name: string;
  duration: number;
  terrain: Terrain;
  /** 敌人种类权重 */
  enemies: { id: string; w: number }[];
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
  lesson: string;
  available: boolean;
}

/**
 * 难度曲线（t = 开局后的分钟数）：
 * 敌人生命 = 关卡倍率 × (1 + hpLin·t + hpQuad·t²)，后期加速，追上玩家升级和多术叠加的成长；
 * 敌人伤害 = 1 + dmgLin·t。调试面板里可以实时调。
 */
export const DIFF = { hpLin: 0.2, hpQuad: 0.03, dmgLin: 0.15 };

const T = (p: Partial<Record<El, number>>): Terrain => ({ metal: 0, wood: 0, water: 0, fire: 0, earth: 0, ...p });

export const LEVELS: LevelDef[] = [
  {
    id: 1, name: '荒郊古道', duration: 360,
    terrain: T({ metal: 0.2, wood: 0.2, water: 0.2, fire: 0.2, earth: 0.2 }),
    enemies: [{ id: 'shiyong', w: 2 }, { id: 'tengguai', w: 3 }, { id: 'shuigui', w: 3 }, { id: 'huoya', w: 1 }, { id: 'tiejia', w: 1 }],
    spawn: [[0, 0.8, 30], [60, 1.6, 70], [120, 2.4, 110], [180, 3.4, 160], [240, 4.6, 220], [300, 3.0, 220]],
    hpMult: 1, boss: 'langyao', bossName: '狼妖', bgm: 'level1', bgmDanger: 'level1_danger',
    ground: 'ground_1',
    decor: [{ tex: 'dc_rock', w: 3 }, { tex: 'dc_tuft', w: 6 }, { tex: 'dc_tablet', w: 1 }, { tex: 'dc_deadtree', w: 1 }],
    decorPerChunk: 7,
    size: 3600, edge: 'dc_rock', elites: { first: 60, every: [55, 30] },
    // 新手关：一道稀疏的乱石带，大半是缺口
    ridges: { tex: 'dc_rock', radius: 8, bands: [0.5], scale: 620, gap: 0.56 },
    lesson: '新手关：留意黄色的“克”字',
    available: true,
  },
  {
    id: 2, name: '竹林', duration: 480,
    terrain: T({ earth: 0.45, water: 0.35, wood: 0.2 }),
    enemies: [{ id: 'tengguai', w: 4 }, { id: 'zhushe', w: 3 }, { id: 'shiyong', w: 2 }, { id: 'zhangchan', w: 1 }],
    spawn: [[0, 1.0, 40], [90, 2.0, 100], [180, 3.2, 160], [300, 4.6, 240], [400, 6.0, 320], [420, 3.5, 320]],
    hpMult: 1.3, boss: 'shuyao', bossName: '千年树妖', bgm: 'level2',
    ground: 'ground_2',
    decor: [{ tex: 'dc_bamboo', w: 5 }, { tex: 'dc_shoot', w: 3 }, { tex: 'dc_mossrock', w: 2 }, { tex: 'dc_fern', w: 4 }],
    decorPerChunk: 7,
    size: 3900, edge: 'dc_bamboo', elites: { first: 60, every: [60, 32] },
    // 一道密竹墙，缺口较多
    ridges: { tex: 'dc_bamboo', radius: 8, bands: [0.5], scale: 540, gap: 0.5 },
    lesson: '金克木，火借势烧木',
    available: true,
  },
  {
    id: 3, name: '山林', duration: 480,
    terrain: T({ earth: 0.7, wood: 0.2, metal: 0.1 }),
    enemies: [{ id: 'shiyong', w: 3 }, { id: 'shanxiao', w: 2 }, { id: 'chuanshan', w: 2 }, { id: 'zhangchan', w: 1 }, { id: 'tengguai', w: 2 }],
    spawn: [[0, 1.1, 45], [90, 2.2, 110], [180, 3.4, 170], [300, 4.8, 250], [400, 6.2, 330], [420, 3.6, 330]],
    hpMult: 1.6, boss: 'shanxiaowang', bossName: '山魈王', bgm: 'level3',
    ground: 'ground_3',
    decor: [{ tex: 'dc_pine', w: 4 }, { tex: 'dc_mossrock', w: 3 }, { tex: 'dc_rock', w: 2 }, { tex: 'dc_fern', w: 3 }, { tex: 'dc_tuft', w: 3 }],
    decorPerChunk: 7,
    size: 4200, edge: 'dc_cliff', elites: { first: 60, every: [60, 32] },
    // 两道岩壁，比竹林密，但山道缺口宽、隔得不远
    ridges: { tex: 'dc_cliff', radius: 11, bands: [0.4, 0.6], scale: 560, gap: 0.56 },
    rockfall: { start: 20, every: [7, 3.5], count: [1, 3], radius: 20, warn: 1.1, dmg: 12 },
    lesson: '顺地气：土生金，金很舒服；山道窄，留意头顶落石',
    available: true,
  },
  // 以下关卡在后续阶段开放，先占位用于选关界面。先轮完单元素（土、火、金、水），第 7 关起混合
  ...([
    [4, '赤焰谷', 600, T({ fire: 0.6, earth: 0.3, metal: 0.1 }), '毕方', '剑客被火克，需要补水或土'],
    [5, '兵冢古战场', 600, T({ metal: 0.6, earth: 0.25, fire: 0.15 }), '刑天', '用火终结复活'],
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
