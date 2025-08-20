/** Utility helpers */
export const rnd = (n) => Math.floor(Math.random()*n);
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const now = () => performance.now();

export function shuffle(a) { for (let i=a.length-1; i>0; i--) { const j=rnd(i+1); [a[i],a[j]]=[a[j],a[i]]; } return a; }
export function deepCopy(obj){ return JSON.parse(JSON.stringify(obj)); }

export function lerp(a,b,t){ return a+(b-a)*t; }
export function easeOutQuad(t){ return 1-(1-t)*(1-t); }

export const COLORS = {
  I:'#62e4f5', J:'#5a8dee', L:'#f5a14b', O:'#f5e662', S:'#74e08a', T:'#c886f0', Z:'#ef6b86', GHOST:'rgba(255,255,255,.15)'
};
