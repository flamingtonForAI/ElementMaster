/** 按像素宽度给中英文混排折行（像素字体：中文 12px，西文约 6px） */
const NO_START = '，。、；：！？”）》,.;:!?)';

export function wrap(s: string, maxW: number): string {
  const lines: string[] = [];
  let line = '';
  let w = 0;
  for (const ch of s) {
    if (ch === '\n') {
      lines.push(line);
      line = '';
      w = 0;
      continue;
    }
    const cw = ch.charCodeAt(0) > 0x2e80 ? 12 : 6;
    // 标点不放行首
    if (w + cw > maxW && line && !NO_START.includes(ch)) {
      // 西文和数字（如 +1%）不拆开：把行尾这一段一起挪到下一行
      const run = cw === 6 && ch !== ' ' ? /[^\s\u2e80-\uffff]+$/.exec(line)?.[0] ?? '' : '';
      if (run && run.length < line.length) {
        lines.push(line.slice(0, -run.length));
        line = run;
        w = run.length * 6;
      } else {
        lines.push(line);
        line = '';
        w = 0;
      }
    }
    line += ch;
    w += cw;
  }
  if (line) lines.push(line);
  return lines.join('\n');
}
