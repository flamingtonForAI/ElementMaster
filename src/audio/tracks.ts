// 程序化 BGM 曲谱。之后换成音频文件时，在 BootScene 里用同名 key load.audio 即可覆盖这里的定义。
//
// 旋律记法：空格分隔，每个记号占一格（res 决定一小节几格）。
//   数字 = 五声音阶的级数（0 为主音，5 为高八度主音，负数往下）
//   -    = 延长上一个音
//   .    = 休止
// 打击乐：X 重击，x 轻击，. 休止

export type Inst = 'qin' | 'dizi' | 'suona' | 'bell' | 'drone' | 'taiko' | 'block' | 'cymbal';

export interface LayerDef {
  inst: Inst;
  /** 局势强度达到多少后加入（0 为始终演奏） */
  at: number;
  vol: number;
  /** 每小节格数：8 为八分音符，16 为十六分音符 */
  res?: 8 | 16;
  /** 整体移调（半音） */
  oct?: number;
  /** 每个字符串一小节，循环播放 */
  bars: string[];
}

export interface TrackDef {
  bpm: number;
  /** 主音 MIDI 音高 */
  root: number;
  /** 调式：五个音相对主音的半音数 */
  mode: number[];
  layers: LayerDef[];
}

const GONG = [0, 2, 4, 7, 9]; // 宫
const SHANG = [0, 2, 5, 7, 10]; // 商
const YU = [0, 3, 5, 7, 10]; // 羽

export const TRACKS: Record<string, TrackDef> = {
  /** 标题：宫调，琴和笛，不上鼓 */
  menu: {
    bpm: 70, root: 60, mode: GONG,
    layers: [
      { inst: 'drone', at: 0, vol: 0.18, oct: -12, bars: ['0 - - - - - - -', '-2 - - - - - - -', '-1 - - - - - - -', '-3 - - - - - - -'] },
      { inst: 'qin', at: 0, vol: 0.5, oct: -12, bars: ['0 2 4 5 7 5 4 2', '-2 0 2 4 5 4 2 0', '-1 1 2 4 6 4 2 1', '-3 -1 0 2 4 2 0 -1'] },
      { inst: 'dizi', at: 0, vol: 0.32, bars: ['7 - - - 6 - 5 -', '4 - - - - - . .', '5 - 6 - 7 - 9 -', '8 - - - - - . .', '7 - 6 - 5 - 4 -', '2 - 4 - 5 - - -', '4 - 2 - 1 - 0 -', '0 - - - - - . .'] },
      { inst: 'bell', at: 0, vol: 0.25, oct: 12, bars: ['. . . . . . . .', '4 . . . . . . .', '. . . . . . . .', '2 . . . . . . .'] },
    ],
  },

  /** 第 1 关 荒郊古道：D 羽调，苍凉；随局势加鼓、加笛 */
  level1: {
    bpm: 92, root: 62, mode: YU,
    layers: [
      { inst: 'drone', at: 0, vol: 0.2, oct: -24, bars: ['0 - - - - - - -', '0 - - - - - - -', '-1 - - - - - - -', '-2 - - - - - - -'] },
      { inst: 'qin', at: 0, vol: 0.55, oct: -12, bars: ['0 . 3 . 5 3 2 .', '0 . 3 . 5 . 6 5', '-1 . 2 . 4 2 1 .', '-2 . 1 . 3 . 2 1'] },
      { inst: 'block', at: 0.15, vol: 0.28, bars: ['X . . x . . x .'] },
      { inst: 'taiko', at: 0.3, vol: 0.55, bars: ['X . . . x . x .', 'X . . . x . X x'] },
      { inst: 'dizi', at: 0.5, vol: 0.34, bars: ['3 - 5 - 6 5 3 -', '2 - 3 2 0 - - -', '3 - 5 - 7 - 6 5', '6 - - 5 3 - - -', '4 - 3 - 2 - 0 -', '2 3 2 0 -1 - - -', '0 - 2 3 5 - 3 2', '3 - - - - - . .'] },
      { inst: 'bell', at: 0.65, vol: 0.22, oct: 12, bars: ['5 . . . . . . .', '. . . . . . . .', '4 . . . . . . .', '. . . . 3 . . .'] },
      { inst: 'taiko', at: 0.78, vol: 0.4, res: 16, bars: ['. . x . . . . x . . x . . x x x'] },
      { inst: 'cymbal', at: 0.85, vol: 0.22, bars: ['X . . . . . . .', '. . . . . . . .'] },
    ],
  },

  /** 第 2 关 竹林：A 商调，梆子打底，笛子主奏 */
  level2: {
    bpm: 108, root: 69, mode: SHANG,
    layers: [
      { inst: 'drone', at: 0, vol: 0.18, oct: -24, bars: ['0 - - - - - - -', '0 - - - - - - -', '-1 - - - - - - -', '-2 - - - - - - -'] },
      { inst: 'qin', at: 0, vol: 0.5, oct: -12, bars: ['0 2 3 . 0 2 4 3', '0 2 3 . 4 3 2 .', '-1 1 2 . -1 1 3 2', '-2 0 1 . 2 1 0 -1'] },
      { inst: 'block', at: 0.1, vol: 0.26, res: 16, bars: ['X . x . x x . x X . x . x x x .'] },
      { inst: 'taiko', at: 0.3, vol: 0.55, bars: ['X . . X . . X .', 'X . . X . X X .'] },
      { inst: 'dizi', at: 0.5, vol: 0.34, bars: ['5 - 6 5 3 - 2 3', '5 - - - 7 6 5 -', '3 - 5 3 2 - 0 2', '3 - - - . . 2 3', '5 6 7 - 6 5 3 -', '2 3 5 - 3 2 0 -', '-1 0 2 - 3 2 0 -', '0 - - - - - . .'] },
      { inst: 'bell', at: 0.65, vol: 0.22, oct: 12, bars: ['0 . . . . . . .', '. . . . 2 . . .', '-2 . . . . . . .', '. . . . -1 . . .'] },
      { inst: 'taiko', at: 0.78, vol: 0.4, res: 16, bars: ['X . x . X . . x X . x . X x X x'] },
      { inst: 'cymbal', at: 0.85, vol: 0.22, bars: ['X . . . . . . .', '. . . . . . . .'] },
    ],
  },

  /** Boss：E 羽调，唢呐 + 密集大鼓，全程满编 */
  boss: {
    bpm: 138, root: 64, mode: YU,
    layers: [
      { inst: 'qin', at: 0, vol: 0.6, oct: -24, bars: ['0 0 3 0 0 0 4 3', '0 0 3 0 5 4 3 2', '-1 -1 2 -1 -1 -1 3 2', '-2 -2 1 -2 2 1 0 -1'] },
      { inst: 'taiko', at: 0, vol: 0.6, res: 16, bars: ['X . . x X . x . X . . x X x X x'] },
      { inst: 'block', at: 0, vol: 0.22, res: 16, bars: ['. . x . . . x . . . x . . x x .'] },
      { inst: 'cymbal', at: 0, vol: 0.22, bars: ['X . . . . . . .', '. . . . x . . .'] },
      { inst: 'suona', at: 0, vol: 0.3, bars: ['5 - 4 5 7 - 6 5', '4 - 3 - 2 - 3 -', '5 - 4 5 7 - 8 7', '6 - 5 - 4 5 3 -', '2 - 3 - 5 - 4 3', '2 - 0 - 2 3 4 -', '5 4 3 2 3 - 0 -', '0 - - - . . 4 5'] },
      { inst: 'bell', at: 0, vol: 0.2, oct: 12, bars: ['0 . . . . . . .', '. . . . . . . .', '-1 . . . . . . .', '. . . . . . . .'] },
    ],
  },
};
