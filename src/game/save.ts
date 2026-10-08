export interface Save {
  unlocked: number;
  lingshi: number;
  musicOn: boolean;
  sfxOn: boolean;
  /** 洞府已购等级 */
  meta: Record<string, number>;
  /** 洞府累计花费，全部退还时原数返还 */
  spent: number;
}

const KEY = 'elementmaster.save';

export function loadSave(): Save {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '');
    return { unlocked: s.unlocked ?? 1, lingshi: s.lingshi ?? 0, musicOn: s.musicOn ?? true, sfxOn: s.sfxOn ?? true, meta: s.meta ?? {}, spent: s.spent ?? 0 };
  } catch {
    return { unlocked: 1, lingshi: 0, musicOn: true, sfxOn: true, meta: {}, spent: 0 };
  }
}

export function writeSave(s: Save) {
  localStorage.setItem(KEY, JSON.stringify(s));
}
