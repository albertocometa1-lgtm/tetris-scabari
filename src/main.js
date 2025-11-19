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
const panelSettings = document.getElementById('panelSettings');
const overSummary = document.getElementById('overSummary');
const mobileSensitivityInput = document.getElementById('rangeMobile');
const displayModeSelect = document.getElementById('selDisplayMode');

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

const getMobileSensitivity = () => {
  if (!mobileSensitivityInput) return 3;
  const v = parseInt(mobileSensitivityInput.value, 10);
  return Number.isFinite(v) ? v : 3;
};

const savedSensitivity = store.get('mobileSensitivity', getMobileSensitivity());
if (mobileSensitivityInput) {
  mobileSensitivityInput.value = savedSensitivity;
  mobileSensitivityInput.addEventListener('input', () => {
    store.set('mobileSensitivity', getMobileSensitivity());
  });
}

const prefersCoarse = matchMedia('(pointer: coarse)');
const DISPLAY_MODES = ['auto','desktop','mobile'];
let displayMode = store.get('displayMode', 'auto');
if (!DISPLAY_MODES.includes(displayMode)) displayMode = 'auto';
if (displayModeSelect) {
  displayModeSelect.value = displayMode;
  displayModeSelect.addEventListener('change', () => {
    applyDisplayMode(displayModeSelect.value);
  });
}

function applyDisplayMode(mode){
  if (!DISPLAY_MODES.includes(mode)) mode = 'auto';
  displayMode = mode;
  store.set('displayMode', mode);
  if (mode === 'auto') {
    delete document.body.dataset.display;
  } else {
    document.body.dataset.display = mode;
  }
  const forceMobile = mode === 'mobile';
  const forceDesktop = mode === 'desktop';
  const showOverlay = forceMobile || (!forceDesktop && prefersCoarse.matches);
  overlay.style.display = showOverlay ? 'block' : 'none';
  overlay.setAttribute('aria-hidden', showOverlay ? 'false' : 'true');
  scheduleFit();
}

const coarseListener = () => {
  if (displayMode === 'auto') applyDisplayMode(displayMode);
};
if (prefersCoarse.addEventListener) {
  prefersCoarse.addEventListener('change', coarseListener);
} else if (prefersCoarse.addListener) {
  prefersCoarse.addListener(coarseListener);
}

applyDisplayMode(displayMode);

// responsive canvas
function fitCanvas(){
  const dpr = window.devicePixelRatio || 1;
  const headerH = document.querySelector('.app-header').getBoundingClientRect().height;
  const hudH = document.querySelector('.sidebar').getBoundingClientRect().height;
  const footerH = document.querySelector('.app-footer').getBoundingClientRect().height;
  const cs = getComputedStyle(document.documentElement);
  const sat = parseFloat(cs.getPropertyValue('--sat')) || 0;
  const sab = parseFloat(cs.getPropertyValue('--sab')) || 0;
  const avail = window.innerHeight - sat - sab - headerH - hudH - footerH;
  stage.style.height = avail + 'px';
  const dpadRect = overlay.querySelector('.dpad').getBoundingClientRect();
  const ctlH = dpadRect.height ? dpadRect.height + 16 : 0;
  const ratio = 10/18;
  let w = stage.clientWidth;
  let h = avail - ctlH;
  if (w / h > ratio) { w = h * ratio; } else { h = w / ratio; }
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

  const doc = document.documentElement;
  const sidebar = document.querySelector('.sidebar');
  if (doc.scrollHeight > doc.clientHeight || doc.scrollWidth > doc.clientWidth) {
    if (!sidebar.classList.contains('compact')) {
      sidebar.classList.add('compact');
      console.log('HUD compact');
      requestAnimationFrame(fitCanvas);
      return;
    } else if (!sidebar.classList.contains('x-compact')) {
      sidebar.classList.add('x-compact');
      console.log('HUD x-compact');
      requestAnimationFrame(fitCanvas);
      return;
    }
  } else {
    sidebar.classList.remove('compact');
    sidebar.classList.remove('x-compact');
  }

  diagnose();
}

let resizeTimer;
function scheduleFit(){ clearTimeout(resizeTimer); resizeTimer = setTimeout(fitCanvas,100); }
addEventListener('resize', scheduleFit);
addEventListener('orientationchange', scheduleFit);
fitCanvas();

function diagnose(){
  const header = document.querySelector('.app-header').getBoundingClientRect();
  const hud = document.querySelector('.sidebar').getBoundingClientRect();
  const canv = canvas.getBoundingClientRect();
  const dpad = overlay.querySelector('.dpad').getBoundingClientRect();
  const footer = document.querySelector('.app-footer').getBoundingClientRect();
  const cs = getComputedStyle(document.documentElement);
  const sat = parseFloat(cs.getPropertyValue('--sat')) || 0;
  const sab = parseFloat(cs.getPropertyValue('--sab')) || 0;
  const budget = window.innerHeight - sat - sab - header.height - hud.height - footer.height - dpad.height;
  console.log('iw', innerWidth, 'ih', innerHeight);
  console.log('header', header.height, 'canvas', canv.height, 'hud', hud.height, 'overlay', dpad.height, 'footer', footer.height);
  console.log('vertical budget', budget);
  console.log('scroll', document.documentElement.scrollHeight, document.documentElement.clientHeight, document.documentElement.scrollWidth, document.documentElement.clientWidth);
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
}, { getMobileSensitivity });

btnPlay.addEventListener('click', startGame);
btnAgain.addEventListener('click', startGame);
btnRestart.addEventListener('click', startGame);
btnResume.addEventListener('click', resumeGame);
btnResume2.addEventListener('click', resumeGame);
btnHome.addEventListener('click', () => { pauseGame(); showPanel(panelHome); });
btnHome2.addEventListener('click', () => { pauseGame(); showPanel(panelHome); });
btnMute.addEventListener('click', () => performAction('mute'));
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
