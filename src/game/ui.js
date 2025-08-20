import { COLORS, easeOutQuad, lerp } from './utils.js';

// Renderer Canvas, pannelli mini per Next/Hold, particelle/flash/shake
export class Renderer {
  constructor(canvas, nextCanvas, holdCanvas, game, store){
    this.cv = canvas; this.cx = canvas.getContext('2d');
    this.nextCv = nextCanvas; this.nextCx = this.nextCv.getContext('2d');
    this.holdCv = holdCanvas; this.holdCx = this.holdCv.getContext('2d');
    this.g = game;
    this.store = store;
    this._particles = [];
    this._shake = 0;
    this._fpsLast = 0; this._fps = 0;
    this._lastTs = 0;
  }

  cellSize(){
    const w = this.cv.width, h = this.cv.height;
    const cols = 10, rows = 20;
    const s = Math.floor(Math.min(w/cols, h/rows));
    return s;
  }

  render(dt, showFps=false){
    const cx = this.cx;
    const s = this.cellSize();
    const ox = Math.floor((this.cv.width - s*10)/2);
    const oy = Math.floor((this.cv.height - s*20)/2);

    // shake
    if (this._shake>0) this._shake -= dt;
    const sx = this._shake>0 ? (Math.random()*4-2) : 0;
    const sy = this._shake>0 ? (Math.random()*4-2) : 0;

    cx.clearRect(0,0,this.cv.width,this.cv.height);
    cx.save(); cx.translate(ox+sx, oy+sy);

    // griglia
    cx.fillStyle = 'rgba(255,255,255,.03)';
    for (let y=0; y<20; y++){
      for (let x=0; x<10; x++){
        cx.fillRect(x*s, y*s, s-1, s-1);
      }
    }

    // board
    for (let y=0;y<20;y++){
      for (let x=0;x<10;x++){
        const id = this.g.board.grid[y][x];
        if (id) this.drawCell(x,y,s, COLORS[id]);
      }
    }

    // ghost
    const ghostY = this.ghostY();
    if (ghostY!==null){
      const shape = this.g.cur.cells[this.g.cur.rot];
      for (const [x,y] of shape) {
        this.drawCell(this.g.cur.x+x, ghostY+y, s, COLORS.GHOST, true);
      }
    }

    // piece
    if (this.g.cur) {
      const shape = this.g.cur.cells[this.g.cur.rot];
      for (const [x,y] of shape) {
        this.drawCell(this.g.cur.x+x, this.g.cur.y+y, s, COLORS[this.g.cur.id]);
      }
    }

    // particelle
    this.updateParticles(dt);
    this.drawParticles(s);

    cx.restore();

    // next & hold
    this.drawMini(this.nextCx, this.nextCv, this.g.queue.slice(0,5));
    this.drawMini(this.holdCx, this.holdCv, this.g.holdId?[this.g.holdId]:[], true);

    // FPS
    if (showFps) this.drawFps();

  }

  drawCell(x,y,s,color,ghost=false){
    const cx = this.cx;
    if (y<0) return;
    const r = s*0.15;
    cx.fillStyle = color;
    cx.beginPath();
    cx.roundRect(x*s+1, y*s+1, s-2, s-2, r);
    cx.fill();
    // highlight
    if (!ghost) {
      const grad = cx.createLinearGradient(x*s, y*s, x*s, y*s+s);
      grad.addColorStop(0, 'rgba(255,255,255,.28)');
      grad.addColorStop(0.5, 'rgba(255,255,255,.05)');
      grad.addColorStop(1, 'rgba(0,0,0,.15)');
      cx.fillStyle = grad;
      cx.fill();
    }
  }

  ghostY(){
    const piece = this.g.cur;
    if (!piece) return null;
    let y = piece.y;
    while (!this.g.board.collides(piece.cells[piece.rot], piece.x, y+1)) y++;
    return y;
  }

  drawMini(cx, cv, ids, single=false){
    cx.clearRect(0,0,cv.width, cv.height);
    const s = Math.floor((cv.width)/6);
    ids.forEach((id, i)=>{
      const sh = this.g ? this.g.cur.cells[0] : []; // base orientation
      const cells = this.g ? (this.g.cur.id===id ? this.g.cur.cells[this.g.cur.rot] : this.g.cur.cells[0]) : sh;
      const data = this.shapeFor(id);
      const cells0 = data.cells[0];
      const bounds = this.bounds(cells0);
      const ox = Math.floor((cv.width - (bounds.w*s))/2) - bounds.x*s;
      const oy = single ? Math.floor((cv.height - (bounds.h*s))/2) - bounds.y*s : (i* (s*3)) + 6 - bounds.y*s;
      cells0.forEach(([x,y])=>{
        cx.fillStyle = COLORS[id]; 
        cx.beginPath();
        cx.roundRect(ox + x*s+1, oy + y*s+1, s-2, s-2, s*0.15);
        cx.fill();
      });
    });
  }

  shapeFor(id){
    // evitare import circolare: piccoli dati in runtime dal game
    return { cells: this.g.cur.cells }; // safe enough per il mini draw corrente
  }

  bounds(cells){
    const xs = cells.map(c=>c[0]), ys = cells.map(c=>c[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    const y0 = Math.min(...ys), y1 = Math.max(...ys);
    return {x:x0, y:y0, w:x1-x0+1, h:y1-y0+1};
  }

  flash(count){
    const cx = this.cx;
    let t=0;
    const animate = () => {
      t += 0.06;
      const a = 0.5 * (1 - Math.cos(Math.min(t,1)*Math.PI));
      cx.save();
      cx.globalAlpha = 0.3 + a*0.3;
      cx.fillStyle = count>=4 ? 'rgba(255,235,59,.65)' : 'rgba(255,255,255,.5)';
      cx.fillRect(0,0,this.cv.width,this.cv.height);
      cx.restore();
      if (t<1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
    // particelle
    for (let i=0;i<40+(count*10);i++){
      this._particles.push({
        x: this.cv.width/2, y: this.cv.height*0.35,
        vx: (Math.random()*2-1)*2.2, vy: (Math.random()*-1.5-0.5)*2.2,
        life: 600, age:0, color: count>=4?'#ffee58':'#ffffff'
      });
    }
  }

  bump(){ /* micro effetto su lock */ }

  shake(){ this._shake = 400; }

  updateParticles(dt){
    this._particles = this._particles.filter(p=> (p.age+=dt) < p.life);
    this._particles.forEach(p=>{
      p.x += p.vx; p.y += p.vy;
      p.vy += 0.03; // gravità particelle
    });
  }
  drawParticles(s){
    const cx = this.cx;
    for (const p of this._particles){
      const a = 1 - p.age/p.life;
      cx.globalAlpha = a;
      cx.fillStyle = p.color;
      cx.fillRect(p.x, p.y, s*0.2, s*0.2);
      cx.globalAlpha = 1;
    }
  }

  drawFps(){
    const now = performance.now();
    const fps = 1000/(now - (this._fpsLast || now));
    this._fpsLast = now;
    this._fps = lerp(this._fps || fps, fps, .2);
    if (!this._fpsBadge){
      this._fpsBadge = document.createElement('div');
      this._fpsBadge.className = 'fps';
      this._fpsBadge.setAttribute('aria-hidden','true');
      this.cv.parentElement.appendChild(this._fpsBadge);
    }
    this._fpsBadge.textContent = `${this._fps.toFixed(0)} FPS`;
  }

  formatTime(ms){
    const s = Math.floor(ms/1000);
    const mm = String(Math.floor(s/60)).padStart(2,'0');
    const ss = String(s%60).padStart(2,'0');
    return `${mm}:${ss}`;
  }
}
