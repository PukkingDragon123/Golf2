/* ===========================================================================
 * audio.js  —  All sound is synthesized with the WebAudio API (no asset files).
 * One-shot SFX for hits, bounces, splashes, sinks, UI, plus a per-world
 * ambient wind bed. Lazily started on the first user gesture.
 * =========================================================================== */
(function (G) {
  'use strict';

  class AudioFX {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.muted = false;
      this.volume = 0.7;
      this.ambient = null;
      this._ambientGain = null;
    }

    ensure() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.ctx.destination);
    }

    setMuted(m) {
      this.muted = m;
      if (this.master) this.master.gain.value = m ? 0 : this.volume;
    }
    setVolume(v) {
      this.volume = v;
      if (this.master && !this.muted) this.master.gain.value = v;
    }

    _env(node, t0, dur, peak, attack) {
      const g = node.gain;
      g.cancelScheduledValues(t0);
      g.setValueAtTime(0.0001, t0);
      g.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + (attack || 0.005));
      g.exponentialRampToValueAtTime(0.0001, t0 + dur);
    }

    tone(o) {
      if (!this.ctx) return;
      const ctx = this.ctx, t0 = ctx.currentTime + (o.delay || 0);
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(o.freq, t0);
      if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.slideTo), t0 + o.dur);
      this._env(g, t0, o.dur, (o.gain || 0.3), o.attack);
      osc.connect(g); g.connect(this.master);
      osc.start(t0); osc.stop(t0 + o.dur + 0.05);
    }

    noise(o) {
      if (!this.ctx) return;
      const ctx = this.ctx, t0 = ctx.currentTime + (o.delay || 0);
      const len = Math.max(1, Math.floor(ctx.sampleRate * o.dur));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filt = ctx.createBiquadFilter();
      filt.type = o.filter || 'lowpass';
      filt.frequency.setValueAtTime(o.freq || 1000, t0);
      if (o.freqTo) filt.frequency.exponentialRampToValueAtTime(Math.max(40, o.freqTo), t0 + o.dur);
      filt.Q.value = o.q || 0.7;
      const g = ctx.createGain();
      this._env(g, t0, o.dur, o.gain || 0.3, o.attack);
      src.connect(filt); filt.connect(g); g.connect(this.master);
      src.start(t0); src.stop(t0 + o.dur + 0.05);
    }

    /* ---- one-shots ---- */
    hit(power) {
      this.ensure();
      const p = Math.max(0, Math.min(1, power || 0.5));
      this.tone({ freq: 280 + p * 220, slideTo: 90, type: 'triangle', dur: 0.12, gain: 0.35 });
      this.noise({ freq: 2600, freqTo: 500, dur: 0.09, gain: 0.25 + p * 0.2, filter: 'bandpass', q: 1.2 });
    }
    putt() { this.ensure(); this.tone({ freq: 200, slideTo: 120, type: 'sine', dur: 0.08, gain: 0.22 }); }
    bounce(s) {
      this.ensure();
      const v = Math.max(0.1, Math.min(1, s || 0.4));
      this.tone({ freq: 160 + v * 260, slideTo: 110, type: 'sine', dur: 0.07, gain: 0.13 * v + 0.05 });
    }
    boing() {
      this.ensure();
      this.tone({ freq: 150, slideTo: 700, type: 'sine', dur: 0.18, gain: 0.3 });
      this.tone({ freq: 700, slideTo: 200, type: 'sine', dur: 0.2, gain: 0.2, delay: 0.06 });
    }
    splash() {
      this.ensure();
      this.noise({ freq: 1800, freqTo: 300, dur: 0.4, gain: 0.32, filter: 'lowpass' });
      this.tone({ freq: 420, slideTo: 160, type: 'sine', dur: 0.25, gain: 0.12 });
    }
    sizzle() { this.ensure(); this.noise({ freq: 3000, freqTo: 800, dur: 0.5, gain: 0.28, filter: 'highpass' }); }
    sink() {
      this.ensure();
      // little rattle then a warm chime
      this.tone({ freq: 520, slideTo: 480, type: 'sine', dur: 0.05, gain: 0.18 });
      this.tone({ freq: 660, type: 'sine', dur: 0.5, gain: 0.25, delay: 0.06 });
      this.tone({ freq: 990, type: 'sine', dur: 0.5, gain: 0.18, delay: 0.1 });
    }
    woosh() { this.ensure(); this.noise({ freq: 500, freqTo: 1600, dur: 0.3, gain: 0.16, filter: 'bandpass', q: 0.8 }); }
    jet() {
      this.ensure();
      this.noise({ freq: 800, freqTo: 1400, dur: 0.3, gain: 0.18, filter: 'bandpass', q: 0.9 });
      this.tone({ freq: 220, slideTo: 320, type: 'sawtooth', dur: 0.3, gain: 0.08 });
    }
    click() { this.ensure(); this.tone({ freq: 660, type: 'square', dur: 0.04, gain: 0.12 }); }
    buy() { this.ensure(); [523, 659, 784, 1047].forEach((f, i) => this.tone({ freq: f, type: 'triangle', dur: 0.18, gain: 0.2, delay: i * 0.06 })); }
    deny() { this.ensure(); this.tone({ freq: 200, slideTo: 120, type: 'square', dur: 0.18, gain: 0.18 }); }
    win() {
      this.ensure();
      const seq = [523, 659, 784, 1047, 1319];
      seq.forEach((f, i) => this.tone({ freq: f, type: 'triangle', dur: 0.5, gain: 0.22, delay: i * 0.12 }));
      this.tone({ freq: 392, type: 'sine', dur: 1.0, gain: 0.14, delay: 0.0 });
    }

    /* ---- ambient wind bed ---- */
    setAmbient(intensity, tone) {
      this.ensure();
      if (!this.ctx) return;
      if (!this.ambient) {
        const len = this.ctx.sampleRate * 2;
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        const src = this.ctx.createBufferSource();
        src.buffer = buf; src.loop = true;
        const filt = this.ctx.createBiquadFilter();
        filt.type = 'lowpass'; filt.frequency.value = tone || 500; filt.Q.value = 0.6;
        const g = this.ctx.createGain(); g.gain.value = 0;
        src.connect(filt); filt.connect(g); g.connect(this.master);
        src.start();
        this.ambient = { src, filt }; this._ambientGain = g;
      }
      const now = this.ctx.currentTime;
      this._ambientGain.gain.cancelScheduledValues(now);
      this._ambientGain.gain.linearRampToValueAtTime(Math.max(0, intensity || 0), now + 1.2);
      if (tone) this.ambient.filt.frequency.linearRampToValueAtTime(tone, now + 1.2);
    }
  }

  G.audio = new AudioFX();
})(window.GOLF = window.GOLF || {});
