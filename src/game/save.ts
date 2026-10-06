export interface Save {
  unlocked: number;
  lingshi: number;
}

const KEY = 'elementmaster.save';

export function loadSave(): Save {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '');
    return { unlocked: s.unlocked ?? 1, lingshi: s.lingshi ?? 0 };
  } catch {
    return { unlocked: 1, lingshi: 0 };
  }
}

export function writeSave(s: Save) {
  localStorage.setItem(KEY, JSON.stringify(s));
}
