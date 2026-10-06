/** 均匀网格，每帧重建，用于敌人的范围查询 */
export class SpatialGrid<T extends { x: number; y: number }> {
  private cells = new Map<number, T[]>();

  constructor(private size = 32) {}

  private key(cx: number, cy: number) {
    return (cx + 32768) * 65536 + (cy + 32768);
  }

  clear() {
    if (this.cells.size > 4000) this.cells.clear();
    else for (const a of this.cells.values()) a.length = 0;
  }

  insert(o: T) {
    const k = this.key(Math.floor(o.x / this.size), Math.floor(o.y / this.size));
    let a = this.cells.get(k);
    if (!a) this.cells.set(k, (a = []));
    a.push(o);
  }

  /** 返回范围所覆盖格子里的对象（调用方自己判断距离） */
  query(x: number, y: number, r: number, out: T[]): T[] {
    out.length = 0;
    const s = this.size;
    const x0 = Math.floor((x - r) / s), x1 = Math.floor((x + r) / s);
    const y0 = Math.floor((y - r) / s), y1 = Math.floor((y + r) / s);
    for (let cy = y0; cy <= y1; cy++)
      for (let cx = x0; cx <= x1; cx++) {
        const a = this.cells.get(this.key(cx, cy));
        if (a) for (const o of a) out.push(o);
      }
    return out;
  }
}
