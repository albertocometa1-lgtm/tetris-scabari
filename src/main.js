import { Game } from './game/engine.js';
import { Renderer } from './game/ui.js';
import { createInput } from './game/input.js';
import { AudioSys } from './game/audio.js';
import { Storage } from './game/storage.js';
import { now } from './game/utils.js';

const canvas = document.getElementById('game');
const nextCanvas = document.getElementById('next');
const holdCanvas = document.getElementById('hold');
const stage = canvas.parentElement;

const scoreEl = document.getElementById('score');
const levelEl = document.getElementById('level');
const linesEl = document.getElementById('lines');
const timerEl = document.getElementById('timer');

const panelHome = document.getElementById('panelHome');
const panelPause = document.getElementById('panelPause');
const panelGameOver = document.getElementById('panelGameOver');
const panelSettings = document.getElementById('panelSettings');
const overSummary = document.getElementById('overSummary');

const btnPlay = document.getElementById('btnPlay');
const btnAgain = document.getElementById('btnAgain');
const btnResume = document.getElementById('btnResume');
const btnResume2 = document.getElementById('btnResume2');
const btnRestart = document.getElementById('btnRestart');
const btnHome = document.getElementById('btnHome');
const btnHome2 = document.getElementById('btnHome2');
const btnMute = document.getElementById('btnMute');
const btnSettings = document.getElementById('btnSettings');
const btnSettings2 = document.getElementById('btnSettings2');
const btnCloseSettings = document.getElementById('btnCloseSettings');
const btnPauseGame = document.getElementById('btnPauseGame');

let currentPanel = panelHome;
let previousPanel = null;
function showPanel(p){
  document.querySelectorAll('.panel').forEach(el => el.classList.remove('show'));
  if (p) {
    p.classList.add('show');
  }
  currentPanel = p;
}

const store = new Storage('tetris');
const audio = new AudioSys(store);
const game = new Game(ev => handleGameEvent(ev));
const renderer = new Renderer(canvas, nextCanvas, holdCanvas, game, store);

// responsive canvas
function fitCanvas(){
  const dpr = window.devicePixelRatio || 1;
  const header = document.querySelector('.app-header');
  const footer = document.querySelector('.app-footer');
  const headerH = header ? header.getBoundingClientRect().height : 0;
  const footerH = footer ? footer.getBoundingClientRect().height : 0;
  const cs = getComputedStyle(document.documentElement);
  const sat = parseFloat(cs.getPropertyValue('--sat')) || 0;
  const sab = parseFloat(cs.getPropertyValue('--sab')) || 0;
  const verticalPadding = 80;
  const maxHeight = Math.max(360, window.innerHeight - sat - sab - headerH - footerH - verticalPadding);
  const ratio = 10/20;
  stage.style.width = '';
  let dispW = stage.clientWidth;
  let dispH = dispW / ratio;
  if (dispH > maxHeight) {
    dispH = maxHeight;
    dispW = dispH * ratio;
  }
  if (dispW <= 0 || dispH <= 0) return;
  stage.style.height = dispH + 'px';
  stage.style.width = dispW + 'px';
  const pxW = Math.floor(dispW * dpr);
  const pxH = Math.floor(dispH * dpr);
  if (canvas.width !== pxW || canvas.height !== pxH){
    canvas.width = pxW; canvas.height = pxH;
    renderer.cx.setTransform(dpr,0,0,dpr,0,0);
  }
  canvas.style.width = dispW + 'px';
  canvas.style.height = dispH + 'px';
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

let paused = true;
let last = now();
const held = {left:false,right:false,soft:false};
const repeat = {left:0,right:0,soft:0};

function updatePauseButton(){
  if (!btnPauseGame) return;
  btnPauseGame.textContent = paused ? 'Riprendi (P)' : 'Pausa (P)';
  btnPauseGame.disabled = paused ? !game.canResume() : false;
}

function startGame(){
  game.newGame();
  audio.ensureContext();
  audio.playMusic();
  paused = false;
  last = now();
  showPanel(null);
  btnResume.hidden = true;
  updatePauseButton();
}

function pauseGame(){
  if (paused) return;
  paused = true;
  btnResume.hidden = false;
  showPanel(panelPause);
  updatePauseButton();
}

function resumeGame(){
  if (!paused) return;
  paused = false;
  showPanel(null);
  last = now();
  updatePauseButton();
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
    updatePauseButton();
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

createInput(canvas, null, (act, pressed) => {
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
btnMute.addEventListener('click', () => performAction('mute'));
if (btnPauseGame) btnPauseGame.addEventListener('click', () => performAction('pause'));
if (btnSettings) btnSettings.addEventListener('click', () => {
  pauseGame();
  previousPanel = panelHome;
  showPanel(panelSettings);
});
if (btnSettings2) btnSettings2.addEventListener('click', () => {
  previousPanel = panelPause;
  showPanel(panelSettings);
});
if (btnCloseSettings) btnCloseSettings.addEventListener('click', () => {
  const target = previousPanel || panelHome;
  showPanel(target);
});

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

updatePauseButton();
