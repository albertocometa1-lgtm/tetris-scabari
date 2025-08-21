import { Game } from './game/engine.js';
import { Renderer } from './game/ui.js';
import { createInput } from './game/input.js';
import { AudioSys } from './game/audio.js';
import { Storage } from './game/storage.js';
import { now } from './game/utils.js';

const canvas = document.getElementById('game');
const nextCanvas = document.getElementById('next');
const holdCanvas = document.getElementById('hold');
const overlay = document.getElementById('touchOverlay');
const stage = canvas.parentElement;

const scoreEl = document.getElementById('score');
const levelEl = document.getElementById('level');
const linesEl = document.getElementById('lines');
const timerEl = document.getElementById('timer');

const panelHome = document.getElementById('panelHome');
const panelPause = document.getElementById('panelPause');
const panelGameOver = document.getElementById('panelGameOver');
const overSummary = document.getElementById('overSummary');

const btnPlay = document.getElementById('btnPlay');
const btnAgain = document.getElementById('btnAgain');
const btnResume = document.getElementById('btnResume');
const btnResume2 = document.getElementById('btnResume2');
const btnRestart = document.getElementById('btnRestart');
const btnHome = document.getElementById('btnHome');
const btnHome2 = document.getElementById('btnHome2');

function showPanel(p){
  document.querySelectorAll('.panel').forEach(el => el.classList.remove('show'));
  if (p) p.classList.add('show');
}

const store = new Storage('tetris');
const audio = new AudioSys(store);
const game = new Game(ev => handleGameEvent(ev));
const renderer = new Renderer(canvas, nextCanvas, holdCanvas, game, store);

// responsive canvas
function fitCanvas(){
  const dpr = window.devicePixelRatio || 1;
  const rect = stage.getBoundingClientRect();
  const ratio = 10/18;
  let w = rect.width;
  let h = rect.height;
  if (w < h){
    w = Math.min(w, h * ratio);
    h = w / ratio;
  } else {
    h = Math.min(h, w / ratio);
    w = h * ratio;
  }
  const dispW = Math.floor(w);
  const dispH = Math.floor(h);
  const pxW = Math.floor(dispW * dpr);
  const pxH = Math.floor(dispH * dpr);
  if (canvas.width !== pxW || canvas.height !== pxH){
    canvas.width = pxW; canvas.height = pxH;
    canvas.style.width = dispW + 'px';
    canvas.style.height = dispH + 'px';
    renderer.cx.setTransform(dpr,0,0,dpr,0,0);
  }
  [nextCanvas, holdCanvas].forEach(cv => {
    const r = cv.getBoundingClientRect();
    const pw = Math.floor(r.width * dpr);
    const ph = Math.floor(r.height * dpr);
    if (cv.width !== pw || cv.height !== ph){
      cv.width = pw; cv.height = ph;
      cv.getContext('2d').setTransform(dpr,0,0,dpr,0,0);
    }
  });
}

let resizeTimer;
function scheduleFit(){ clearTimeout(resizeTimer); resizeTimer = setTimeout(fitCanvas,100); }
addEventListener('resize', scheduleFit);
addEventListener('orientationchange', scheduleFit);
fitCanvas();

// touch overlay only on coarse pointers
if (matchMedia('(pointer: coarse)').matches){
  overlay.style.display = 'block';
  overlay.removeAttribute('aria-hidden');
}

let paused = true;
let last = now();
const held = {left:false,right:false,soft:false};
const repeat = {left:0,right:0,soft:0};

function startGame(){
  game.newGame();
  audio.ensureContext();
  audio.playMusic();
  paused = false;
  last = now();
  showPanel(null);
  btnResume.hidden = true;
}

function pauseGame(){
  if (paused) return;
  paused = true;
  btnResume.hidden = false;
  showPanel(panelPause);
}

function resumeGame(){
  if (!paused) return;
  paused = false;
  showPanel(null);
  last = now();
}

function handleGameEvent(ev){
  if (ev.type === 'lock') {
    scoreEl.textContent = game.score;
    levelEl.textContent = game.level;
    linesEl.textContent = game.lines;
  } else if (ev.type === 'lineClear') {
    renderer.flash(ev.count);
    audio.fx(ev.count >= 4 ? 'tetris' : 'line');
  } else if (ev.type === 'spawn') {
    renderer.spawn();
  } else if (ev.type === 'gameOver') {
    audio.fx('over');
    paused = true;
    overSummary.textContent = `Score: ${game.score}`;
    showPanel(panelGameOver);
  }
}

function performAction(act){
  switch (act) {
    case 'left': game.move(-1); audio.fx('move'); break;
    case 'right': game.move(1); audio.fx('move'); break;
    case 'soft': game.softDrop(); break;
    case 'hard': game.hardDrop(); audio.fx('drop'); break;
    case 'rotL': game.rotate(-1); audio.fx('rotate'); break;
    case 'rotR': game.rotate(1); audio.fx('rotate'); break;
    case 'hold': game.hold(); break;
    case 'pause': paused ? resumeGame() : pauseGame(); break;
    case 'mute': audio.toggleMute(); break;
  }
}

createInput(canvas, overlay, (act, pressed) => {
  if (act === 'left' || act === 'right' || act === 'soft') {
    held[act] = pressed;
    if (pressed) { performAction(act); repeat[act] = 0; }
  } else if (pressed) {
    performAction(act);
  }
});

btnPlay.addEventListener('click', startGame);
btnAgain.addEventListener('click', startGame);
btnRestart.addEventListener('click', startGame);
btnResume.addEventListener('click', resumeGame);
btnResume2.addEventListener('click', resumeGame);
btnHome.addEventListener('click', () => { pauseGame(); showPanel(panelHome); });
btnHome2.addEventListener('click', () => { pauseGame(); showPanel(panelHome); });

function loop(ts){
  const dt = ts - last;
  last = ts;
  if (!paused) {
    game.update(dt);
    ['left','right','soft'].forEach(act => {
      if (held[act]) {
        repeat[act] += dt;
        const delay = act === 'soft' ? 50 : 150;
        if (repeat[act] >= delay) {
          performAction(act);
          repeat[act] = 0;
        }
      }
    });
    renderer.render(dt);
    const m = Math.floor(game.msElapsed / 60000).toString().padStart(2,'0');
    const s = Math.floor((game.msElapsed / 1000) % 60).toString().padStart(2,'0');
    timerEl.textContent = `${m}:${s}`;
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js', { scope: './' });
}
