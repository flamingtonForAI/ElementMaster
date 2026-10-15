import type { Mods } from './startree';

/**
 * 传承：每个角色专属的小星盘，两个分支各 3 个节点，同一分支要按顺序点。
 * 传承点来自里程碑（见 legacyPoints），总数少于节点数，必须取舍。
 *
 * 剑客专用加成：
 * xiao.turn 剑气斩与上一斩方向相差 90° 以上时的伤害加成；xiao.chain 每第 3 斩带剑气波；
 * slashCd 剑气斩冷却缩短；slashArea 剑气斩范围；xiao.armorMelee 每点护甲的近身伤害加成
 *
 * 符师专用加成：
 * zhu.draw 画符概率；zhu.alt 异色符伤害；zhu.thunder 每第 5 张符画成克制目标的元素；
 * zhu.extra 每次多抛的符数；zhu.area 火符爆炸范围；zhu.echo 原地再爆一次的伤害比例
 *
 * 海贼专用加成：
 * ruan.splash 浪花伤害比例；ruan.splashArea 浪花范围；ruan.chain 浪花可暴击并再溅的层数；
 * ruan.kite 背离敌人移动时冷却加速；ruan.range 连弩射程与箭速；ruan.pierce 连弩贯穿
 */
export interface LegacyNode {
  id: string;
  name: string;
  glyph: string;
  /** 没有通用加成说明时写在这里 */
  note?: string;
  mods: Mods;
}

export interface LegacyBranch {
  name: string;
  /** 一句话说明这一支的玩法方向 */
  desc: string;
  nodes: LegacyNode[];
}

export const LEGACIES: Record<string, LegacyBranch[]> = {
  xiao: [
    {
      name: '剑意',
      desc: '靠走位转身出剑，越会操作越强',
      nodes: [
        { id: 'xiao.a1', name: '回锋', glyph: '回', note: '剑气斩与上一斩方向相差 90° 以上时，伤害 +40%', mods: { 'xiao.turn': 0.4 } },
        { id: 'xiao.a2', name: '连斩', glyph: '连', note: '每第 3 次剑气斩额外斩出一道剑气波', mods: { 'xiao.chain': 1 } },
        { id: 'xiao.a3', name: '剑心', glyph: '心', note: '剑气斩冷却 −15%，范围 +10%', mods: { slashCd: 0.15, slashArea: 0.1 } },
      ],
    },
    {
      name: '铁衣',
      desc: '贴身站桩，用护甲换伤害',
      nodes: [
        { id: 'xiao.b1', name: '铁衣', glyph: '衣', mods: { armor: 2 } },
        { id: 'xiao.b2', name: '贴身', glyph: '贴', mods: { meleeRange: 30 } },
        { id: 'xiao.b3', name: '以甲为锋', glyph: '甲', note: '每点护甲使近身伤害 +3%', mods: { 'xiao.armorMelee': 0.03 } },
      ],
    },
  ],
  zhu: [
    {
      name: '画符',
      desc: '画出更多异色符，用克制打人',
      nodes: [
        { id: 'zhu.a1', name: '丹青', glyph: '丹', note: '画符概率 +15%', mods: { 'zhu.draw': 0.15 } },
        { id: 'zhu.a2', name: '符引', glyph: '引', note: '异色符伤害 +35%', mods: { 'zhu.alt': 0.35 } },
        { id: 'zhu.a3', name: '五雷', glyph: '雷', note: '每第 5 张符必定画成克制目标的元素（需要已有该系的术）', mods: { 'zhu.thunder': 1 } },
      ],
    },
    {
      name: '符海',
      desc: '只修火符，越抛越多，越炸越大',
      nodes: [
        { id: 'zhu.b1', name: '连符', glyph: '连', note: '每次多抛 1 张火符', mods: { 'zhu.extra': 1 } },
        { id: 'zhu.b2', name: '烈符', glyph: '烈', note: '火符爆炸范围 +20%', mods: { 'zhu.area': 0.2 } },
        { id: 'zhu.b3', name: '符海', glyph: '海', note: '火符爆炸后原地再爆一次，伤害 50%', mods: { 'zhu.echo': 0.5 } },
      ],
    },
  ],
  ruan: [
    {
      name: '浪花',
      desc: '堆暴击，让水花一浪接一浪',
      nodes: [
        { id: 'ruan.a1', name: '浪涌', glyph: '涌', mods: { crit: 0.06 } },
        { id: 'ruan.a2', name: '碎浪', glyph: '碎', note: '浪花伤害 +30%，范围 +30%', mods: { 'ruan.splash': 0.3, 'ruan.splashArea': 0.3 } },
        { id: 'ruan.a3', name: '回澜', glyph: '澜', note: '浪花也能暴击，暴击的浪花再溅一次', mods: { 'ruan.chain': 1 } },
      ],
    },
    {
      name: '风筝',
      desc: '边退边打，拉开距离就是输出',
      nodes: [
        { id: 'ruan.b1', name: '退射', glyph: '退', note: '背离最近的敌人移动时，所有术冷却加快 30%', mods: { 'ruan.kite': 0.3 } },
        { id: 'ruan.b2', name: '远扬', glyph: '远', note: '连弩射程和箭速 +30%', mods: { 'ruan.range': 0.3 } },
        { id: 'ruan.b3', name: '分水', glyph: '分', note: '连弩贯穿 +2', mods: { 'ruan.pierce': 2 } },
      ],
    },
  ],
};

/** 首通这些关各得 1 点传承点；劫数上线后再加第 5 劫 */
export const LEGACY_LEVELS = [2, 5, 8];
