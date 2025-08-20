import { Board } from './board.js';
import { TETROMINOES, JLSTZ_KICKS } from './tetrominoes.js';
import { shuffle } from './utils.js';

const PIECES = Object.keys(TETROMINOES);
const GRAVITY_BY_LEVEL = [0.8,0.72,0.63,0.55,0.47,0.4,0.33,0.27,0.22,0.18,0.15,0.12,0.1]; // sec per cell
const SCORE = { SINGLE:100, DOUBLE:300, TRIPLE:500, TETRIS:800, SOFT:1, HARD:2, TSPIN:400 };

export class Game {
  constructor(onEvent) {
    this.onEvent = onEvent || (()=>{});
    this.board = new Board(10,20);
  }
  newGame() {
    this.board.reset();
    this.level = 1;
    this.lines = 0;
    this.score = 0;
    this.msElapsed = 0;
    this.cur = null;
    this.holdId = null; this.heldThisTurn = false;
    this.queue = [];
    this.lastId = null;
    this.refill();
    this.spawn();
    this.gameOver = false;
  }
  canResume(){ return !!this.cur && !this.gameOver; }

  refill(){
    const bag = shuffle(PIECES.slice());
    if (this.lastId && bag[0] === this.lastId) [bag[0], bag[1]] = [bag[1], bag[0]];
    this.queue.push(...bag);
  }
  pull(){
    if (this.queue.length <= 7) this.refill();
    const id = this.queue.shift();
    this.lastId = id;
    return id;
  }
  spawn(){
    const id = this.pull();
    const data = TETROMINOES[id];
    this.cur = { id, rot:0, x:3, y:-2, cells:data.cells };
    if (this.collides(this.cur, this.cur.x, this.cur.y)) {
      this.gameOver = true;
      this.onEvent({type:'gameOver'});
    } else {
      this.heldThisTurn = false;
      this.onEvent({type:'spawn', id});
    }
  }
  collides(piece, x, y){
    const shape = piece.cells[piece.rot];
    return this.board.collides(shape, x, y);
  }
  move(dir){
    if (this.gameOver) return;
    const nx = this.cur.x + dir;
    if (!this.collides(this.cur, nx, this.cur.y)) this.cur.x = nx;
  }
  rotate(dir){
    if (this.gameOver) return;
    const from = this.cur.rot;
    const to = (from + (dir>0?1:3)) % 4;
    const id = this.cur.id;
    const kicks = id==='I' ? TETROMINOES.I.kicks : JLSTZ_KICKS;
    const key = `${from}>${to}`;
    const trials = (kicks[key] || [[0,0]]);
    for (const [dx,dy] of trials) {
      if (!this.collides(this.cur, this.cur.x + dx, this.cur.y + dy)) {
        this.cur.rot = to; this.cur.x += dx; this.cur.y += dy;
        return;
      }
    }
  }
  softDrop(){ if (!this.step(1)) this.lockPiece(); this.score += SCORE.SOFT; }
  hardDrop(){
    let dist = 0;
    while (this.step(1)) { dist++; }
    this.score += SCORE.HARD * dist;
    this.lockPiece();
  }
  hold(){
    if (this.heldThisTurn) return;
    const curId = this.cur.id;
    if (this.holdId == null) {
      this.holdId = curId;
      this.spawn();
    } else {
      this.cur.id = this.holdId;
      this.cur.cells = TETROMINOES[this.cur.id].cells;
      this.cur.rot = 0; this.cur.x = 3; this.cur.y = -2;
      this.holdId = curId;
      if (this.collides(this.cur, this.cur.x, this.cur.y)) {
        this.gameOver = true; this.onEvent({type:'gameOver'});
      }
    }
    this.heldThisTurn = true;
  }
  step(dy){
    const ny = this.cur.y + dy;
    if (!this.collides(this.cur, this.cur.x, ny)) { this.cur.y = ny; return true; }
    return false;
  }
  lockPiece(){
    const shape = this.cur.cells[this.cur.rot];
    this.board.lock(shape, this.cur.x, this.cur.y, this.cur.id);
    this.onEvent({type:'lock'});
    const cleared = this.board.clearLines();
    if (cleared>0) {
      let add = 0;
      if (cleared===1) add = SCORE.SINGLE;
      else if (cleared===2) add = SCORE.DOUBLE;
      else if (cleared===3) add = SCORE.TRIPLE;
      else if (cleared>=4) add = SCORE.TETRIS;
      this.score += add;
      this.lines += cleared;
      this.onEvent({type:'lineClear', count: cleared});
      if (this.lines >= this.level*10) this.level++;
    }
    this.spawn();
  }
  gravitySec(){ return GRAVITY_BY_LEVEL[Math.min(this.level-1, GRAVITY_BY_LEVEL.length-1)]; }

  update(dt){
    if (this.gameOver) return;
    this.msElapsed += dt;
    // gravità
    this._gAcc = (this._gAcc||0) + dt/1000;
    const gSec = this.gravitySec();
    if (this._gAcc >= gSec) {
      this._gAcc -= gSec;
      if (!this.step(1)) this.lockPiece();
    }
  }
}
