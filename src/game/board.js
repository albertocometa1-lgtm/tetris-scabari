import { deepCopy } from './utils.js';

export class Board {
  constructor(w=10,h=20) {
    this.w = w; this.h = h;
    this.grid = this.create();
  }
  create() {
    return Array.from({length:this.h}, ()=>Array(this.w).fill(0));
  }
  reset(){ this.grid = this.create(); }
  inside(x,y){ return x>=0 && x<this.w && y>=0 && y<this.h; }
  cell(x,y){ return this.grid[y]?.[x] || 0; }
  collides(shape, ox, oy) {
    for (const [x,y] of shape) {
      const px = ox + x, py = oy + y;
      if (px < 0 || px >= this.w) return true;
      if (py >= this.h) return true;
      if (py < 0) continue; // allow spawn above board but keep lateral bounds
      if (this.cell(px,py)) return true;
    }
    return false;
  }
  lock(shape, ox, oy, id) {
    for (const [x,y] of shape) {
      const px = ox + x, py = oy + y;
      if (py >= 0 && py < this.h) this.grid[py][px] = id;
    }
  }
  clearLines() {
    const keep = this.grid.filter(row => row.some(v => !v));
    const cleared = this.h - keep.length;
    if (cleared>0) {
      const newRows = Array.from({length:cleared}, ()=>Array(this.w).fill(0));
      this.grid = newRows.concat(keep);
    }
    return cleared;
  }
  snapshot() { return deepCopy(this.grid); }
}
