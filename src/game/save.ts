import { UPGRADES, WUDAO_MAX, wudaoPrice } from '../config/meta';
import { CHARACTERS } from '../config/characters';
import { LEVELS } from '../config/levels';
import { STAR, CENTER } from '../config/startree';
import { LEGACIES } from '../config/legacy';
import { daoPoints, legacyPoints, treeStart } from './talents';

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
  /** 每个角色实际通关过的关卡号 */
  clears: Record<string, number[]>;
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
const VER = 5;

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
    return s && typeof s === 'object' && !Array.isArray(s) ? s : null;
  } catch {
    return null;
  }
}

const record = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const number = (v: unknown, fallback = 0, max = Number.MAX_SAFE_INTEGER) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, v)) : fallback;
const integer = (v: unknown, fallback = 0, max = Number.MAX_SAFE_INTEGER) => Math.floor(number(v, fallback, max));
const ids = (v: unknown, allowed: Set<string>) =>
  Array.isArray(v) ? [...new Set(v.filter((id): id is string => typeof id === 'string' && allowed.has(id)))] : [];

/** 只留和起点连通的星图节点；中宫只有散人能点 */
function connected(start: string, v: unknown) {
  const lit = new Set(ids(v, new Set(Object.keys(STAR))));
  lit.delete(start);
  if (start !== CENTER) lit.delete(CENTER);
  const seen = new Set<string>();
  const q = [start];
  while (q.length) {
    for (const l of STAR[q.pop()!].links) {
      if (lit.has(l) && !seen.has(l)) {
        seen.add(l);
        q.push(l);
      }
    }
  }
  return [...lit].filter((id) => seen.has(id));
}

/** 补齐缺的字段并按版本迁移；本地读取和导入共用校验 */
function normalize(s: Record<string, any>): Save {
  const base = fresh();
  const ver = integer(s.ver, 1);
  const save: Save = {
    ...base,
    unlocked: Math.max(1, integer(s.unlocked, 1, Math.max(...LEVELS.map((l) => l.id)) + 1)),
    lingshi: integer(s.lingshi),
    spent: integer(s.spent),
    notice: typeof s.notice === 'string' ? s.notice : '',
    lastChar: CHARACTERS.some((c) => c.id === s.lastChar) ? s.lastChar : '',
    runs: integer(s.runs),
    playTime: number(s.playTime),
    createdAt: number(s.createdAt, base.createdAt),
    updatedAt: number(s.updatedAt, base.updatedAt),
  };
  const meta = record(s.meta);
  for (const u of UPGRADES) if (u.id in meta) save.meta[u.id] = integer(meta[u.id], 0, u.maxLv);
  const clears = record(s.clears);
  const tree = record(s.tree);
  const legacy = record(s.legacy);
  const wudao = record(s.wudao);
  for (const c of CHARACTERS) {
    const oldClear = clears[c.id];
    // 旧版只记最高关号，按原规则保留已获得的点数；新版只记实际通关。
    save.clears[c.id] = ver < 4 && typeof oldClear === 'number'
      ? LEVELS.filter((l) => l.id <= integer(oldClear)).map((l) => l.id)
      : Array.isArray(oldClear) ? [...new Set(oldClear.filter((n): n is number => LEVELS.some((l) => l.id === n)))] : [];
    save.tree[c.id] = connected(treeStart(c), tree[c.id]);
    // 传承同一分支要按顺序点，断层之后的不算
    const lg = new Set(ids(legacy[c.id], new Set((LEGACIES[c.id] ?? []).flatMap((b) => b.nodes.map((n) => n.id)))));
    save.legacy[c.id] = (LEGACIES[c.id] ?? []).flatMap((b) => {
      const k = b.nodes.findIndex((n) => !lg.has(n.id));
      return b.nodes.slice(0, k < 0 ? b.nodes.length : k).map((n) => n.id);
    });
    save.wudao[c.id] = integer(wudao[c.id], 0, WUDAO_MAX);
  }
  // 点数不够撑起已点的星图或传承时清空重点（v3 改制及手改存档码）
  const reset: string[] = [];
  for (const c of CHARACTERS) {
    if (save.tree[c.id].length > daoPoints(save, c) || save.legacy[c.id].length > legacyPoints(save, c)) {
      save.tree[c.id] = [];
      save.legacy[c.id] = [];
      reset.push(c.name);
    }
  }
  if (reset.length) save.notice = `${reset.join('、')}的星图与传承超出可用点数，已清空，可重新点。`;
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
    const bought = integer(s.wudao, 0, WUDAO_MAX);
    if (bought > 0) {
      let back = 0;
      for (let i = 0; i < bought; i++) back += wudaoPrice(i);
      save.lingshi += back;
      notes.push(`悟道改为每个角色各自购买，已退还 ${back} 灵石`);
    }
    if (reset.length) notes.push(`${reset.join('、')}的星图与传承已清空，可重新点`);
    if (notes.length) save.notice = `洞府改制：道点和传承点改为每个角色自己首通才给。${notes.join('；')}。`;
  }
  // v5：星图重绘（辐条加长、新增合化区和相克奇穴），已点的星图全部清空，道点原数退还
  if (ver < 5) {
    const cleared = CHARACTERS.filter((c) => save.tree[c.id].length > 0);
    for (const c of cleared) save.tree[c.id] = [];
    if (cleared.length) save.notice = `${save.notice ? `${save.notice}\n` : ''}星图重绘：辐条加长，新增合化区和相克奇穴。${cleared.map((c) => c.name).join('、')}的星图已清空，道点全部退还。`;
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
  return `EM${VER}:` + btoa(unescape(encodeURIComponent(JSON.stringify(s))));
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
  if (!s || typeof s.unlocked !== 'number' || !Number.isFinite(s.unlocked) || (typeof s.ver === 'number' && s.ver > VER)) return false;
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
