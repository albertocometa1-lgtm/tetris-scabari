// Tastiera + touch overlay + (facolt.) gamepad scan
export function createInput(canvas, overlay, handler, options = {}){
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

  const getMobileSensitivity = () => {
    const val = Number(options.getMobileSensitivity?.()) || 3;
    return Math.min(5, Math.max(1, val));
  };

  const tapAction = (act) => {
    handler(act, true);
    handler(act, false);
  };

  const gesture = {
    id: null,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    accumX: 0,
    accumY: 0,
    startTime: 0
  };

  const resetGesture = () => {
    gesture.id = null;
    gesture.accumX = 0;
    gesture.accumY = 0;
  };

  const findTouch = (touchList) => {
    return Array.from(touchList).find(t => t.identifier === gesture.id) || null;
  };

  const movementThreshold = () => {
    const sens = getMobileSensitivity();
    return 28 - (sens - 3) * 4; // range ~20-36px
  };

  const flickThreshold = () => movementThreshold() * 1.4;

  // Touch overlay
  // Touch controls
  let longPressTimer = null;
  if (overlay) {
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
  }

  // double tap on canvas -> rotate left
  let lastTap = 0;
  canvas.addEventListener('touchend', (e)=>{
    const ts = e.timeStamp;
    if (ts - lastTap < 300) {
      handler('rotL', true);
      handler('rotL', false);
    }
    lastTap = ts;
  });

  // gesture sliding on canvas for mobile
  canvas.addEventListener('touchstart', (e) => {
    if (gesture.id !== null) return;
    const t = e.changedTouches[0];
    if (!t) return;
    gesture.id = t.identifier;
    gesture.startX = t.clientX;
    gesture.startY = t.clientY;
    gesture.lastX = t.clientX;
    gesture.lastY = t.clientY;
    gesture.accumX = 0;
    gesture.accumY = 0;
    gesture.startTime = e.timeStamp;
    e.preventDefault();
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    if (gesture.id === null) return;
    const t = findTouch(e.changedTouches);
    if (!t) return;
    e.preventDefault();
    const dx = t.clientX - gesture.lastX;
    const dy = t.clientY - gesture.lastY;
    gesture.accumX += dx;
    gesture.accumY += dy;
    gesture.lastX = t.clientX;
    gesture.lastY = t.clientY;
    const threshold = movementThreshold();
    while (gesture.accumX <= -threshold) {
      tapAction('left');
      gesture.accumX += threshold;
    }
    while (gesture.accumX >= threshold) {
      tapAction('right');
      gesture.accumX -= threshold;
    }
    while (gesture.accumY >= threshold) {
      tapAction('soft');
      gesture.accumY -= threshold;
    }
  }, { passive: false });

  const handleGestureEnd = (touch, timeStamp) => {
    if (!touch) return;
    const totalY = touch.clientY - gesture.startY;
    const totalX = touch.clientX - gesture.startX;
    const duration = timeStamp - gesture.startTime;
    const flick = flickThreshold();
    if (totalY > flick && duration < 220) {
      tapAction('hard');
    } else if (totalY < -flick) {
      tapAction('rotR');
    } else if (Math.abs(totalX) > flick && Math.abs(totalY) < flick * 0.6) {
      tapAction(totalX > 0 ? 'right' : 'left');
    }
    resetGesture();
  };

  ['touchend','touchcancel'].forEach(type => {
    canvas.addEventListener(type, (e) => {
      if (gesture.id === null) return;
      const t = findTouch(e.changedTouches);
      if (!t) return;
      e.preventDefault();
      handleGestureEnd(t, e.timeStamp);
    }, { passive: false });
  });

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
