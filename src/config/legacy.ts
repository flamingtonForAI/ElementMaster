import type { Mods } from './startree';

/**
 * 传承：每个角色专属的小星盘，两个分支各 3 个节点，同一分支要按顺序点。
 * 传承点来自里程碑（见 legacyPoints），总数少于节点数，必须取舍。
 *
 * 剑客专用加成：
 * xiao.turn 剑气斩与上一斩方向相差 90° 以上时的伤害加成；xiao.chain 每第 3 斩追加剑气波，Lv5 起强化该轮双向波；
 * slashCd 剑气斩冷却缩短；slashArea 剑气斩范围；xiao.armorMelee 每点护甲的近身伤害加成
 *
 * 符师专用加成：
 * zhu.draw 画符概率；zhu.alt 异色符伤害；zhu.thunder 每第 5 张符画成克制目标的元素；
 * zhu.extra 每次多抛的符数；zhu.extraDmg 追加符伤害比例；zhu.area 火符爆炸范围；zhu.echo 原地再爆一次的伤害比例
 *
 * 海贼专用加成：
 * ruan.splash 浪花伤害比例；ruan.splashArea 浪花范围；ruan.chain 浪花可暴击并再溅的层数；
 * ruan.kite 背离敌人移动时冷却加速；ruan.range 连弩射程与箭速；ruan.pierce 连弩贯穿
 *
 * 药师专用加成：
 * qing.shield 生命满时回复转护盾的上限（占最大生命）；qing.shieldDmg 有护盾时伤害加成；
 * qing.cloud 毒雾光环范围；qing.cloudDur 离开毒雾后中毒多持续的秒数；qing.spread 中毒敌人死亡时传染；qing.vuln 中毒敌人受到的伤害加成
 *
 * 傀儡师专用加成：
 * mo.shellDmg 元素外壳傀儡伤害；mo.shellProc 外壳傀儡攻击必定触发该系异常；mo.shellCleave 外壳傀儡扑击范围；
 * mo.hp 傀儡生命；mo.giantLv 提前到这一级合成巨傀；mo.giantDmg 巨傀攻击伤害加成；mo.quake 巨傀震地范围
 *
 * 散人专用加成：
 * xuan.period 周天轮转间隔（秒，负数是缩短）；xuan.known 只轮转已学术元素；xuan.bonus 周天加成；xuan.burst 轮转时爆发；
 * xuan.variety 每个不同元素的术给的伤害；xuan.even 五系灵根相差不超过 3 时的伤害；xuan.taiji 五系灵根都不低于 2 时全面加成
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
      desc: '游身折转出剑，剑招连绵不绝',
      nodes: [
        { id: 'xiao.a1', name: '回锋', glyph: '回', note: '剑气斩与上一斩方向相差 90° 以上时，伤害 +40%', mods: { 'xiao.turn': 0.4 } },
        { id: 'xiao.a2', name: '连斩', glyph: '连', note: '每第 3 斩追加剑气波；剑气斩 Lv5 起改为该轮双向剑气波伤害 +75%', mods: { 'xiao.chain': 1 } },
        { id: 'xiao.a3', name: '剑心', glyph: '心', note: '剑气斩冷却 −15%，范围 +10%', mods: { slashCd: 0.15, slashArea: 0.1 } },
      ],
    },
    {
      name: '铁衣',
      desc: '重甲欺身，化守势为锋芒',
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
      desc: '化符入五气，借生克之道诛邪',
      nodes: [
        { id: 'zhu.a1', name: '丹青', glyph: '丹', note: '画符概率 +15%', mods: { 'zhu.draw': 0.15 } },
        { id: 'zhu.a2', name: '符引', glyph: '引', note: '异色符伤害 +35%', mods: { 'zhu.alt': 0.35 } },
        { id: 'zhu.a3', name: '五雷', glyph: '雷', note: '每第 5 张符必定化为克制目标的元素（需已修该系术法）', mods: { 'zhu.thunder': 1 } },
      ],
    },
    {
      name: '符海',
      desc: '专精本命火符，漫天烈符轰炸',
      nodes: [
        { id: 'zhu.b1', name: '连符', glyph: '连', note: '每次多祭出 1 张火符，追加符造成 50% 伤害', mods: { 'zhu.extra': 1, 'zhu.extraDmg': 0.5 } },
        { id: 'zhu.b2', name: '烈符', glyph: '烈', note: '火符爆裂范围 +20%', mods: { 'zhu.area': 0.2 } },
        { id: 'zhu.b3', name: '符海', glyph: '海', note: '火符爆裂后于原地再震爆一次，伤害 50%', mods: { 'zhu.echo': 0.5 } },
      ],
    },
  ],
  ruan: [
    {
      name: '惊涛',
      desc: '凝暴击激起惊涛，水花层层叠涌',
      nodes: [
        { id: 'ruan.a1', name: '浪涌', glyph: '涌', mods: { crit: 0.06 } },
        { id: 'ruan.a2', name: '碎浪', glyph: '碎', note: '惊涛水花伤害 +30%，范围 +30%', mods: { 'ruan.splash': 0.3, 'ruan.splashArea': 0.3 } },
        { id: 'ruan.a3', name: '回澜', glyph: '澜', note: '惊涛水花亦可暴击，暴击时再激起一层水花', mods: { 'ruan.chain': 1 } },
      ],
    },
    {
      name: '寒汐',
      desc: '借步拉远距离，连矢破浪贯敌',
      nodes: [
        { id: 'ruan.b1', name: '退射', glyph: '退', note: '背离最近的敌人移动时，所有术法冷却加快 30%', mods: { 'ruan.kite': 0.3 } },
        { id: 'ruan.b2', name: '远扬', glyph: '远', note: '连弩射程与箭速 +30%', mods: { 'ruan.range': 0.3 } },
        { id: 'ruan.b3', name: '分水', glyph: '分', note: '连弩贯穿 +2', mods: { 'ruan.pierce': 2 } },
      ],
    },
  ],
  qingdai: [
    {
      name: '护心',
      desc: '盈余生机凝为护盾，固本培元',
      nodes: [
        { id: 'qing.a1', name: '回春', glyph: '春', mods: { regen: 0.4 } },
        { id: 'qing.a2', name: '护心', glyph: '护', note: '气血充盈时，溢出回复化为护盾，最多为生命上限的 20%', mods: { 'qing.shield': 0.2 } },
        { id: 'qing.a3', name: '固元', glyph: '固', note: '护盾上限再 +15%；身怀护盾时伤害 +15%', mods: { 'qing.shield': 0.15, 'qing.shieldDmg': 0.15 } },
      ],
    },
    {
      name: '传染',
      desc: '散播百草毒瘴，于敌群间蔓延不绝',
      nodes: [
        { id: 'qing.b1', name: '药性', glyph: '药', note: '毒雾范围 +25%，离雾后余毒延长 1 秒', mods: { 'qing.cloud': 0.25, 'qing.cloudDur': 1 } },
        { id: 'qing.b2', name: '传染', glyph: '染', note: '中毒的敌人毙命时，将毒素传予周围敌人', mods: { 'qing.spread': 1 } },
        { id: 'qing.b3', name: '蚀骨', glyph: '蚀', note: '中毒的敌人受到的伤害 +20%', mods: { 'qing.vuln': 0.2 } },
      ],
    },
  ],
  moheng: [
    {
      name: '灌注',
      desc: '兼修诸系术法，为傀儡覆五行外甲',
      nodes: [
        { id: 'mo.a1', name: '灌注', glyph: '灌', note: '元素外甲傀儡伤害 +30%', mods: { 'mo.shellDmg': 0.3 } },
        { id: 'mo.a2', name: '印契', glyph: '契', note: '元素外甲傀儡的扑击必定触发该系异常', mods: { 'mo.shellProc': 1 } },
        { id: 'mo.a3', name: '五方', glyph: '方', note: '元素外甲傀儡扑击范围 +50%', mods: { 'mo.shellCleave': 0.5 } },
      ],
    },
    {
      name: '巨傀',
      desc: '精炼机关偃甲，凝巨傀独当正面',
      nodes: [
        { id: 'mo.b1', name: '坚壁', glyph: '壁', note: '傀儡生命 +30%', mods: { 'mo.hp': 0.3 } },
        { id: 'mo.b2', name: '早成', glyph: '成', note: '石傀儡 Lv5 合为巨傀，震地威力逐级成长；巨傀伤害 +15%，满级仍有效', mods: { 'mo.giantLv': 5, 'mo.giantDmg': 0.15 } },
        { id: 'mo.b3', name: '撼地', glyph: '撼', note: '巨傀震地范围 +50%', mods: { 'mo.quake': 0.5 } },
      ],
    },
  ],
  xuanyi: [
    {
      name: '周天',
      desc: '五气轮转愈疾，当令威势倍增',
      nodes: [
        { id: 'xuan.a1', name: '小周天', glyph: '小', note: '周天轮转间隔 30 → 20 秒，仅在已修术法的元素间轮转', mods: { 'xuan.period': -10, 'xuan.known': 1 } },
        { id: 'xuan.a2', name: '大周天', glyph: '大', note: '周天当令元素伤害加成由 +25% 增至 +65%', mods: { 'xuan.bonus': 0.4 } },
        { id: 'xuan.a3', name: '归元', glyph: '归', note: '每次周天轮转，以新当令之一系于周身爆发一次', mods: { 'xuan.burst': 1 } },
      ],
    },
    {
      name: '太极',
      desc: '五气并修齐进，混元一气自成',
      nodes: [
        { id: 'xuan.b1', name: '两仪', glyph: '仪', note: '每修得一门不同元素的术法，全部伤害 +4%', mods: { 'xuan.variety': 0.04 } },
        { id: 'xuan.b2', name: '四象', glyph: '象', note: '五系灵根最高与最低相差不超过 3 时，全部伤害 +12%', mods: { 'xuan.even': 0.12 } },
        { id: 'xuan.b3', name: '太极', glyph: '极', note: '五系灵根皆不低于 2 时，伤害 +15%、冷却 −10%、移速 +10%', mods: { 'xuan.taiji': 1 } },
      ],
    },
  ],
};

/** 本角色最高通关达到这些关卡时各得 1 点，跳关自动补齐此前奖励。 */
export const LEGACY_LEVELS = [2, 5, 8];
