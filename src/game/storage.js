export class Storage {
  constructor(ns){ this.ns = ns; }
  k(k){ return `${this.ns}:${k}`; }
  get(k, def){ try{ const v = localStorage.getItem(this.k(k)); return v==null?def:JSON.parse(v);}catch{return def;} }
  set(k, v){ localStorage.setItem(this.k(k), JSON.stringify(v)); }
  addHighScore(s){
    const arr = this.get('scores', []);
    arr.push(s); arr.sort((a,b)=>b-a);
    this.set('scores', arr.slice(0,20));
  }
  getHighScores(){ return this.get('scores', []); }
  clearHighScores(){ localStorage.removeItem(this.k('scores')); }
}
