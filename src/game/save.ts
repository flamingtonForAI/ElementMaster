import { wudaoPrice } from '../config/meta';
import { CHARACTERS } from '../config/characters';
import { daoPoints, legacyPoints } from './talents';

/** 一个存档槽的全部进度 */
export interface Save {
  unlocked: number;
  lingshi: number;
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
  /** 每个角色悟道买过的道点 */
  wudao: Record<string, number>;
  /** 洞府提示，看过后清空 */
  notice: string;
  /** 最近一局用的角色，首页存档卡片上显示 */
  lastChar: string;
  /** 已结束的局数 */
  runs: number;
  /** 累计局内时长（秒） */
  playTime: number;
  createdAt: number;
  updatedAt: number;
  ver: number;
}

/** 全局设置，不跟存档走 */
export interface Settings {
  musicOn: boolean;
  sfxOn: boolean;
  /** 当前使用的槽位（1 起） */
  slot: number;
}

export const SLOTS = 5;
const PREFIX = 'elementmaster.';
const LEGACY_KEY = 'save';
const SETTINGS_KEY = 'settings';
const slotKey = (n: number) => `slot.${n}`;
const VER = 3;

/** 存储层：现在是 localStorage，以后上云只换这里 */
const store = {
  get(k: string): string | null {
    try {
      return localStorage.getItem(PREFIX + k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string) {
    try {
      localStorage.setItem(PREFIX + k, v);
    } catch {
      // 隐私模式或空间满时只在本次会话里有效
    }
  },
  remove(k: string) {
    try {
      localStorage.removeItem(PREFIX + k);
    } catch {
      // 同上
    }
  },
};

function fresh(): Save {
  const now = Date.now();
  return { unlocked: 1, lingshi: 0, meta: {}, spent: 0, tree: {}, legacy: {}, clears: {}, wudao: {}, notice: '', lastChar: '', runs: 0, playTime: 0, createdAt: now, updatedAt: now, ver: VER };
}

function parse(raw: string | null): Record<string, any> | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    return s && typeof s === 'object' ? s : null;
  } catch {
    return null;
  }
}

/** 补齐缺的字段并按版本迁移 */
function normalize(s: Record<string, any>): Save {
  const base = fresh();
  const save: Save = {
    ...base,
    unlocked: s.unlocked ?? 1,
    lingshi: s.lingshi ?? 0,
    meta: s.meta ?? {},
    spent: s.spent ?? 0,
    tree: s.tree ?? {},
    legacy: s.legacy ?? {},
    clears: s.clears ?? {},
    wudao: typeof s.wudao === 'object' && s.wudao ? s.wudao : {},
    notice: s.notice ?? '',
    lastChar: s.lastChar ?? '',
    runs: s.runs ?? 0,
    playTime: s.playTime ?? 0,
    createdAt: s.createdAt ?? base.createdAt,
    updatedAt: s.updatedAt ?? base.updatedAt,
  };
  const ver = s.ver ?? 1;
  // v1 的五行天赋树改成了星图，部分修炼搬进星图：修炼和天赋全部按花费退还
  if (ver < 2 && save.spent > 0) {
    save.notice = `洞府重修：天赋树改为星图，威力、锐眼、广域、迅捷搬进星图。原有修炼与天赋已全部退还 ${save.spent} 灵石。`;
    save.lingshi += save.spent;
    save.spent = 0;
    save.meta = {};
  }
  // v3：道点、传承点改成每个角色自己首通才给，悟道改成每个角色各买各的
  if (ver < 3) {
    const notes: string[] = [];
    const bought = typeof s.wudao === 'number' ? s.wudao : 0;
    if (bought > 0) {
      let back = 0;
      for (let i = 0; i < bought; i++) back += wudaoPrice(i);
      save.lingshi += back;
      notes.push(`悟道改为每个角色各自购买，已退还 ${back} 灵石`);
    }
    const reset: string[] = [];
    for (const c of CHARACTERS) {
      if ((save.tree[c.id]?.length ?? 0) > daoPoints(save, c) || (save.legacy[c.id]?.length ?? 0) > legacyPoints(save, c)) {
        save.tree[c.id] = [];
        save.legacy[c.id] = [];
        reset.push(c.name);
      }
    }
    if (reset.length) notes.push(`${reset.join('、')}的星图与传承已清空，可重新点`);
    if (notes.length) save.notice = `洞府改制：道点和传承点改为每个角色自己首通才给。${notes.join('；')}。`;
  }
  return save;
}

// ---------- 设置 ----------

export function loadSettings(): Settings {
  const s = parse(store.get(SETTINGS_KEY));
  if (s) return { musicOn: s.musicOn ?? true, sfxOn: s.sfxOn ?? true, slot: s.slot ?? 1 };
  // 旧版的声音开关存在存档里
  const old = parse(store.get(LEGACY_KEY));
  return { musicOn: old?.musicOn ?? true, sfxOn: old?.sfxOn ?? true, slot: 1 };
}

export function writeSettings(s: Settings) {
  store.set(SETTINGS_KEY, JSON.stringify(s));
}

// ---------- 槽位 ----------

/** 旧版单存档搬进槽位 1，旧 key 留着当备份 */
function migrateLegacy() {
  if (store.get(slotKey(1)) !== null) return;
  for (let n = 2; n <= SLOTS; n++) if (store.get(slotKey(n)) !== null) return;
  const old = parse(store.get(LEGACY_KEY));
  if (!old) return;
  store.set(slotKey(1), JSON.stringify(normalize(old)));
  writeSettings(loadSettings());
}

export function readSlot(n: number): Save | null {
  migrateLegacy();
  const s = parse(store.get(slotKey(n)));
  return s ? normalize(s) : null;
}

/** 五个槽位的存档，空槽为 null */
export function listSlots(): (Save | null)[] {
  return Array.from({ length: SLOTS }, (_, i) => readSlot(i + 1));
}

export function activeSlot() {
  return loadSettings().slot;
}

export function useSlot(n: number) {
  writeSettings({ ...loadSettings(), slot: n });
}

/** 在槽位 n 新建空存档并设为当前 */
export function newSlot(n: number) {
  store.set(slotKey(n), JSON.stringify(fresh()));
  useSlot(n);
}

export function deleteSlot(n: number) {
  store.remove(slotKey(n));
}

/** 存档码：带前缀的 base64 JSON，用于备份和换设备 */
export function exportSlot(n: number): string {
  const s = readSlot(n);
  if (!s) return '';
  return 'EM3:' + btoa(unescape(encodeURIComponent(JSON.stringify(s))));
}

export function importSlot(n: number, code: string): boolean {
  const m = code.trim().match(/^EM\d+:(.+)$/s);
  if (!m) return false;
  let s;
  try {
    s = parse(decodeURIComponent(escape(atob(m[1].replace(/\s/g, '')))));
  } catch {
    return false;
  }
  if (!s || typeof s.unlocked !== 'number') return false;
  store.set(slotKey(n), JSON.stringify(normalize(s)));
  return true;
}

/** 当前槽位的存档；槽位是空的就给一份新的（写入时才建档） */
export function loadSave(): Save {
  return readSlot(activeSlot()) ?? fresh();
}

export function writeSave(s: Save) {
  store.set(slotKey(activeSlot()), JSON.stringify({ ...s, updatedAt: Date.now(), ver: VER }));
}
