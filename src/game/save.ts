export interface Save {
  unlocked: number;
  lingshi: number;
  musicOn: boolean;
  sfxOn: boolean;
}

const KEY = 'elementmaster.save';

export function loadSave(): Save {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '');
    return { unlocked: s.unlocked ?? 1, lingshi: s.lingshi ?? 0, musicOn: s.musicOn ?? true, sfxOn: s.sfxOn ?? true };
  } catch {
    return { unlocked: 1, lingshi: 0, musicOn: true, sfxOn: true };
  }
}

export function writeSave(s: Save) {
  localStorage.setItem(KEY, JSON.stringify(s));
}
