// WebAudio sound, all synthesised in code: engine hum, police siren, gunshots,
// crashes, pickups and mission jingles. No audio files, no network.
export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let muted = false;
  let lastEngine = 0;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 50;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(ctx.destination);
      sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      gain.gain.setValueAtTime(vol || 0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur + 0.02);
    } catch { /* sound is decoration; never break the game */ }
  }

  function noise(dur, vol, lowFreq) {
    if (!ctx || muted) return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowFreq || 1200;
      const gain = ctx.createGain();
      gain.gain.value = vol || 0.25;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      src.start();
    } catch { /* ignore */ }
  }

  return {
    ensure,
    setMuted(value) {
      muted = value;
      if (engineGain) engineGain.gain.value = 0;
      if (sirenGain) sirenGain.gain.value = 0;
    },
    isMuted() { return muted; },
    engine(speed, driving) {
      if (!ctx || muted) return;
      const now = performance.now();
      if (now - lastEngine < 90) return;
      lastEngine = now;
      const target = driving ? 0.05 + Math.min(0.09, Math.abs(speed) / 440 * 0.09) : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(46 + Math.abs(speed) * 0.22, ctx.currentTime, 0.1);
    },
    siren(on, dt) {
      if (!ctx || !sirenOsc) return;
      if (!on || muted) {
        sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
        return;
      }
      sirenTimer += dt;
      const high = Math.floor(sirenTimer * 1.6) % 2 === 0;
      sirenOsc.frequency.setTargetAtTime(high ? 880 : 620, ctx.currentTime, 0.05);
      sirenGain.gain.setTargetAtTime(0.045, ctx.currentTime, 0.1);
    },
    shot() { noise(0.14, 0.3, 2600); blip(180, 0.08, 'square', 0.1, 60); },
    punch() { noise(0.08, 0.2, 700); },
    crash() { noise(0.3, 0.4, 500); blip(70, 0.25, 'sine', 0.25, 40); },
    pickup() { blip(660, 0.1, 'sine', 0.14); blip(990, 0.14, 'sine', 0.12); },
    cash() { blip(880, 0.09, 'sine', 0.14); blip(1174, 0.09, 'sine', 0.14); blip(1568, 0.16, 'sine', 0.14); },
    missionDone() {
      blip(523, 0.12, 'triangle', 0.16);
      setTimeout(() => blip(659, 0.12, 'triangle', 0.16), 120);
      setTimeout(() => blip(784, 0.22, 'triangle', 0.18), 240);
    },
    busted() { blip(440, 0.3, 'sawtooth', 0.12, 220); },
    horn() { blip(340, 0.22, 'square', 0.07); },
  };
}
