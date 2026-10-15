export interface Save {
  unlocked: number;
  lingshi: number;
  musicOn: boolean;
  sfxOn: boolean;
  /** 洞府修炼已购等级 */
  meta: Record<string, number>;
  /** 修炼累计花费，全部退还时原数返还 */
  spent: number;
  /** 每个角色点亮的星位（不含起点） */
  tree: Record<string, string[]>;
  /** 每个角色点亮的传承节点 */
  legacy: Record<string, string[]>;
  /** 每个角色通关过的最高关卡号 */
  clears: Record<string, number>;
  /** 悟道买过的道点 */
  wudao: number;
  /** 洞府提示，看过后清空 */
  notice: string;
  ver: number;
}

const KEY = 'elementmaster.save';
const VER = 2;

function fresh(): Save {
  return { unlocked: 1, lingshi: 0, musicOn: true, sfxOn: true, meta: {}, spent: 0, tree: {}, legacy: {}, clears: {}, wudao: 0, notice: '', ver: VER };
}

export function loadSave(): Save {
  let s;
  try {
    s = JSON.parse(localStorage.getItem(KEY) || '');
  } catch {
    return fresh();
  }
  const save: Save = {
    ...fresh(),
    unlocked: s.unlocked ?? 1,
    lingshi: s.lingshi ?? 0,
    musicOn: s.musicOn ?? true,
    sfxOn: s.sfxOn ?? true,
    meta: s.meta ?? {},
    spent: s.spent ?? 0,
    tree: s.tree ?? {},
    legacy: s.legacy ?? {},
    clears: s.clears ?? {},
    wudao: s.wudao ?? 0,
    notice: s.notice ?? '',
  };
  // v1 的五行天赋树改成了星图，部分修炼搬进星图：修炼和天赋全部按花费退还
  if ((s.ver ?? 1) < 2 && save.spent > 0) {
    save.notice = `洞府重修：天赋树改为星图，威力、锐眼、广域、迅捷搬进星图。原有修炼与天赋已全部退还 ${save.spent} 灵石。`;
    save.lingshi += save.spent;
    save.spent = 0;
    save.meta = {};
  }
  return save;
}

export function writeSave(s: Save) {
  localStorage.setItem(KEY, JSON.stringify({ ...s, ver: VER }));
}
