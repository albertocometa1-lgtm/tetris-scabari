// Tastiera + touch overlay + (facolt.) gamepad scan
export function createInput(canvas, overlay, handler){
  const keymap = {
    ArrowLeft: 'left',
    ArrowRight: 'right',
    ArrowDown: 'soft',
    Space: 'hard',
    KeyZ: 'rotL',
    KeyX: 'rotR',
    ArrowUp: 'rotR',
    KeyC: 'hold',
    KeyP: 'pause',
    KeyM: 'mute'
  };

  const keydown = (e) => {
    const act = keymap[e.code];
    if (act){ e.preventDefault(); handler(act, true); }
  };
  const keyup = (e) => {
    const act = keymap[e.code];
    if (act){ e.preventDefault(); handler(act, false); }
  };
  addEventListener('keydown', keydown);
  addEventListener('keyup', keyup);

  // Touch overlay
  // Touch controls
  let longPressTimer = null;
  overlay.addEventListener('touchstart', (e)=>{
    const t=e.target.closest('.ctl'); if (!t) return;
    e.preventDefault();
    t.setAttribute('aria-pressed','true');
    handler(t.dataset.act, true);
    if (t.dataset.act==='soft'){
      longPressTimer = setTimeout(()=>handler('hard', true), 450);
    }
  }, {passive:false});
  overlay.addEventListener('touchend', (e)=>{
    const t=e.target.closest('.ctl'); if (!t) return;
    e.preventDefault();
    t.removeAttribute('aria-pressed');
    handler(t.dataset.act, false);
    if(longPressTimer){ clearTimeout(longPressTimer); longPressTimer=null; }
  }, {passive:false});

  // Gamepad (base)
  let gpId = null;
  const poll = () => {
    const pads = navigator.getGamepads?.() || [];
    const gp = pads.find(p=>p && p.connected);
    if (!gp) { gpId=null; requestAnimationFrame(poll); return; }
    if (gp.id !== gpId) gpId = gp.id;
    // Mapping basilare (A=hard, B=rotR, X=rotL, Y=hold, dpad)
    const b = gp.buttons;
    if (b[12]?.pressed) handler('soft', true);
    if (b[14]?.pressed) handler('left', true);
    if (b[15]?.pressed) handler('right', true);
    if (b[0]?.pressed) handler('hard', true);
    if (b[1]?.pressed) handler('rotR', true);
    if (b[2]?.pressed) handler('rotL', true);
    if (b[3]?.pressed) handler('hold', true);
    requestAnimationFrame(poll);
  };
  requestAnimationFrame(poll);

  return { destroy(){
    removeEventListener('keydown',keydown);
    removeEventListener('keyup',keyup);
  }};
}
