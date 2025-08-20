// Web Audio: 5 tracce musicali sintetiche + FX (move/rotate/drop/line/tetris/over)
export class AudioSys {
  constructor(store){
    this.store = store;
    this.ctx = null;
    this.musicGain = null;
    this.fxGain = null;
    this.muted = this.store.get('muted', false);
    this.trackIdx = this.store.get('musicIdx', 0);
    this.volMusic = this.store.get('volMusic', 0.6);
    this.volFx = this.store.get('volFx', 0.8);
  }
  ensureContext(){
    if (this.ctx) return;
    const ctx = new (window.AudioContext||window.webkitAudioContext)();
    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : 1;
    master.connect(ctx.destination);
    const m = ctx.createGain(); m.gain.value = this.volMusic;
    const f = ctx.createGain(); f.gain.value = this.volFx;
    m.connect(master); f.connect(master);
    this.ctx = ctx; this.master = master; this.musicGain = m; this.fxGain = f;
  }
  toggleMute(){
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted?0:1;
    this.store.set('muted', this.muted);
  }
  setMusicVolume(v){ this.volMusic=v; if(this.musicGain) this.musicGain.gain.value=v; }
  setFxVolume(v){ this.volFx=v; if(this.fxGain) this.fxGain.gain.value=v; }
  selectTrack(i){ this.trackIdx = i; this.store.set('musicIdx', i); }

  stopMusic(){ if (this._musOsc) { this._musOsc.stop(); this._musOsc.disconnect(); this._musOsc=null; } if (this._seqTimer) cancelAnimationFrame(this._seqTimer); }
  playMusic(){
    if (!this.ctx) this.ensureContext();
    this.stopMusic();
    // Sequencer molto leggero a passi da 0.25 beat, 90-130 BPM
    const BPM = [96,104,110,118,126][this.trackIdx|0];
    const SPB = 60/BPM;
    const scale = [0,2,3,5,7,10]; // esatonale minor-ish
    const base = [48,50,43,45,47][this.trackIdx|0]; // MIDI-like base pitch

    let step = 0;
    const loopLen = 64;
    const scheduleWindow = 0.12;
    const ctx = this.ctx;

    const schedule = () => {
      const now = ctx.currentTime;
      while (!this._nextTime || this._nextTime < now + scheduleWindow) {
        this._nextTime = (this._nextTime||now) + SPB/2; // 8th notes
        // bass every beat
        if (step%2===0) this._tone(this._note(base + scale[(step/2)%scale.length]), this._nextTime, 0.12, 'tri', this.musicGain, .18);
        // lead every 4th
        if (step%4===0) this._tone(this._note(base+12 + scale[(step/4*2)%scale.length]), this._nextTime+0.01, 0.08, 'sine', this.musicGain, .12);
        // hihat style noise
        if (step%1===0) this._noise(this._nextTime, 0.03, this.musicGain, 6000, 0.3);
        step = (step+1)%loopLen;
      }
      this._seqTimer = requestAnimationFrame(schedule);
    };
    schedule();
  }

  fx(type){
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    switch(type){
      case 'move': this._blip(t, 700, 0.02); break;
      case 'rotate': this._blip(t, 900, 0.04); break;
      case 'drop': this._sweep(t, 200, 80, 0.08); break;
      case 'line': this._chord(t, [420,520,660], 0.09); break;
      case 'tetris': this._chord(t, [360,480,600,760], 0.14); break;
      case 'over': this._sweep(t, 220, 40, 0.6, 'saw'); break;
    }
  }

  _note(n){ return 440*Math.pow(2,(n-69)/12); }
  _tone(freq, when, dur, type, gainNode, vol=0.2){
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(vol, when+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, when+dur);
    o.connect(g); g.connect(gainNode);
    o.start(when); o.stop(when+dur+0.02);
  }
  _noise(when, dur, gainNode, cutoff=8000, vol=0.15){
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate*dur, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i=0;i<data.length;i++) data[i]=Math.random()*2-1;
    const src = this.ctx.createBufferSource(); src.buffer = buffer;
    const g = this.ctx.createGain(); g.gain.value = vol;
    const f = this.ctx.createBiquadFilter(); f.type='highpass'; f.frequency.value=cutoff;
    src.connect(f); f.connect(g); g.connect(gainNode);
    src.start(when); src.stop(when+dur);
  }
  _blip(t, f, d){ this._tone(f, t, d, 'square', this.fxGain, 0.2); }
  _sweep(t, from, to, d, type='triangle'){
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type=type; o.frequency.setValueAtTime(from, t); o.frequency.exponentialRampToValueAtTime(to, t+d);
    g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.0001, t+d);
    o.connect(g); g.connect(this.fxGain);
    o.start(t); o.stop(t+d+0.02);
  }
  _chord(t, freqs, d){ freqs.forEach((f,i)=>this._tone(f, t+i*0.005, d, 'sine', this.fxGain, 0.22)); }
}
