import type { El, Terrain } from './elements';

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
  ground: string;
  decor: { tex: string; w: number }[];
  decorPerChunk: number;
  lesson: string;
  available: boolean;
}

const T = (p: Partial<Record<El, number>>): Terrain => ({ metal: 0, wood: 0, water: 0, fire: 0, earth: 0, ...p });

export const LEVELS: LevelDef[] = [
  {
    id: 1, name: '荒郊古道', duration: 360,
    terrain: T({ metal: 0.2, wood: 0.2, water: 0.2, fire: 0.2, earth: 0.2 }),
    enemies: [{ id: 'shiyong', w: 2 }, { id: 'tengguai', w: 3 }, { id: 'shuigui', w: 3 }, { id: 'huoya', w: 1 }, { id: 'tiejia', w: 1 }],
    spawn: [[0, 0.8, 30], [60, 1.6, 70], [120, 2.4, 110], [180, 3.4, 160], [240, 4.6, 220], [300, 3.0, 220]],
    hpMult: 1, boss: 'langyao', bossName: '狼妖',
    ground: 'ground_1',
    decor: [{ tex: 'dc_rock', w: 3 }, { tex: 'dc_tuft', w: 6 }, { tex: 'dc_tablet', w: 1 }, { tex: 'dc_deadtree', w: 1 }],
    decorPerChunk: 7,
    lesson: '新手关：留意黄色的“克”字',
    available: true,
  },
  {
    id: 2, name: '竹林', duration: 480,
    terrain: T({ earth: 0.45, water: 0.35, wood: 0.2 }),
    enemies: [{ id: 'tengguai', w: 7 }, { id: 'shiyong', w: 3 }],
    spawn: [[0, 1.0, 40], [90, 2.0, 100], [180, 3.2, 160], [300, 4.6, 240], [400, 6.0, 320], [420, 3.5, 320]],
    hpMult: 1.3, boss: 'shuyao', bossName: '千年树妖',
    ground: 'ground_2',
    decor: [{ tex: 'dc_bamboo', w: 5 }, { tex: 'dc_shoot', w: 3 }, { tex: 'dc_mossrock', w: 2 }, { tex: 'dc_fern', w: 4 }],
    decorPerChunk: 9,
    lesson: '金克木，火借势烧木',
    available: true,
  },
  // 以下关卡在后续阶段开放，先占位用于选关界面
  ...([
    [3, '山林', 480, T({ earth: 0.7, wood: 0.2, metal: 0.1 }), '山魈王', '顺地气：金很舒服'],
    [4, '赤焰谷', 600, T({ fire: 0.6, earth: 0.3, metal: 0.1 }), '毕方', '剑客被火克，需要补水或土'],
    [5, '大漠', 600, T({ earth: 0.6, metal: 0.3, fire: 0.1 }), '旱魃', '双修：一种元素顾不过来'],
    [6, '云梦泽', 600, T({ water: 0.7, earth: 0.2, wood: 0.1 }), '相柳', '三个角色都打不顺'],
    [7, '寒江', 720, T({ water: 0.55, metal: 0.35, earth: 0.1 }), '玄冥', '冰面滑行'],
    [8, '兵冢古战场', 720, T({ metal: 0.6, earth: 0.25, fire: 0.15 }), '刑天', '用火终结复活'],
    [9, '东海归墟', 720, T({ water: 0.5, fire: 0.3, earth: 0.2 }), '九婴', '答案是土'],
    [10, '昆仑', 900, T({ metal: 0.2, wood: 0.2, water: 0.2, fire: 0.2, earth: 0.2 }), '帝江', '期末考'],
  ] as const).map(([id, name, duration, terrain, bossName, lesson]): LevelDef => ({
    id, name, duration, terrain, bossName, lesson,
    enemies: [], spawn: [], hpMult: 1, boss: '', ground: 'ground_1', decor: [], decorPerChunk: 0,
    available: false,
  })),
];
