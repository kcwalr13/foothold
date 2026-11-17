// Sound, made in code like everything else: no sound files. Each sound is a few lines of Web Audio, a burst of
// noise through a filter or a tone that slides, kept small and toy-like: pops and thumps, not war films.
// Nothing here touches the rules; the match tells it what happened and where.

type Voice = 'rifle' | 'zip' | 'rocket' | 'cannon' | 'mortar' | 'flak' | 'rattle' | 'bite' | 'stomp' | 'screech' | 'spit'
  | 'boom' | 'crash' | 'ready' | 'ding' | 'horn' | 'level' | 'coin' | 'whoosh' | 'blast' | 'win' | 'lose' | 'tap';

/** The shortest gap between two of the same sound, in milliseconds: a hundred rifles make a crackle, not a roar. */
const GAP: Record<Voice, number> = {
  rifle: 45, zip: 45, rocket: 90, cannon: 110, mortar: 140, flak: 70, rattle: 90, bite: 60, stomp: 160, screech: 160, spit: 70,
  boom: 140, crash: 120, ready: 200, ding: 300, horn: 2500, level: 400, coin: 120, whoosh: 150, blast: 150, win: 0, lose: 0, tap: 40,
};

const KEY = 'foothold.sound';

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private last = new Map<Voice, number>();
  /** Sounds still ringing, so a big fight never stacks up more than a dozen at once. */
  private live = 0;
  on = remembered();
  /** How many sounds have played: for the tests, which can't listen. */
  played = 0;

  /** Browsers only start sound from a tap: the first one anywhere opens it. */
  unlock(): void {
    if (!this.on) return;
    try {
      if (!this.ctx) {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.55;
        this.master.connect(this.ctx.destination);
        const n = this.ctx.sampleRate;
        this.noise = this.ctx.createBuffer(1, n, n);
        const d = this.noise.getChannelData(0);
        // A fixed pattern of noise: the screen's own business, nothing to do with the rules' dice.
        let s = 12345;
        for (let i = 0; i < n; i++) {
          s = (s * 1103515245 + 12345) >>> 0;
          d[i] = (s / 0xffffffff) * 2 - 1;
        }
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  set(on: boolean): void {
    this.on = on;
    try {
      localStorage.setItem(KEY, on ? 'on' : 'off');
    } catch { /* kept for this visit only */ }
    if (on) this.unlock();
    else if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  /**
   * Plays a sound. `pan` runs from -1 (left of the screen) to 1, `vol` from 0 to 1 and `pitch` scales every
   * frequency, so the same pop can come from a smaller or a bigger gun.
   */
  play(v: Voice, vol = 1, pan = 0, pitch = 1): void {
    const ctx = this.ctx, out = this.master;
    if (!this.on || !ctx || !out || ctx.state !== 'running' || vol <= 0.02) return;
    const now = performance.now();
    if (now - (this.last.get(v) ?? -1e9) < GAP[v] || this.live >= 12) return;
    this.last.set(v, now);
    const t = ctx.currentTime;
    const bus = ctx.createGain();
    bus.gain.value = Math.min(1, vol);
    let end: AudioNode = bus;
    if (pan !== 0 && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      bus.connect(p);
      end = p;
    }
    end.connect(out);
    let length = 0;
    const noise = (at: number, dur: number, type: BiquadFilterType, f0: number, f1: number, q: number, gain: number) => {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.Q.value = q;
      f.frequency.setValueAtTime(f0 * pitch, t + at);
      f.frequency.exponentialRampToValueAtTime(Math.max(30, f1 * pitch), t + at + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + at);
      g.gain.exponentialRampToValueAtTime(gain, t + at + Math.min(0.008, dur / 4));
      g.gain.exponentialRampToValueAtTime(0.0001, t + at + dur);
      src.connect(f).connect(g).connect(bus);
      src.start(t + at, (now % 900) / 1000, dur + 0.05);
      length = Math.max(length, at + dur);
    };
    const tone = (at: number, dur: number, type: OscillatorType, f0: number, f1: number, gain: number) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f0 * pitch, t + at);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, f1 * pitch), t + at + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + at);
      g.gain.exponentialRampToValueAtTime(gain, t + at + Math.min(0.01, dur / 4));
      g.gain.exponentialRampToValueAtTime(0.0001, t + at + dur);
      o.connect(g).connect(bus);
      o.start(t + at);
      o.stop(t + at + dur + 0.02);
      length = Math.max(length, at + dur);
    };
    switch (v) {
      case 'rifle': noise(0, 0.05, 'bandpass', 2600, 1400, 1.1, 0.5); break;
      case 'zip': noise(0, 0.04, 'bandpass', 3600, 2200, 1.4, 0.35); break;
      case 'rocket': noise(0, 0.2, 'bandpass', 900, 2600, 2, 0.45); tone(0, 0.12, 'triangle', 300, 600, 0.12); break;
      case 'cannon': tone(0, 0.2, 'sine', 150, 45, 0.7); noise(0, 0.14, 'lowpass', 900, 200, 0.7, 0.5); break;
      case 'mortar': tone(0, 0.09, 'sine', 320, 130, 0.5); noise(0, 0.06, 'lowpass', 1200, 400, 0.8, 0.3); break;
      case 'flak': noise(0, 0.035, 'bandpass', 1500, 900, 1.5, 0.45); noise(0.06, 0.035, 'bandpass', 1500, 900, 1.5, 0.35); break;
      case 'rattle': for (let i = 0; i < 3; i++) noise(i * 0.045, 0.03, 'bandpass', 2000, 1200, 1.2, 0.35); break;
      case 'bite': tone(0, 0.045, 'square', 230, 150, 0.12); tone(0.06, 0.045, 'square', 200, 130, 0.1); break;
      case 'stomp': tone(0, 0.28, 'sine', 90, 35, 0.8); noise(0, 0.2, 'lowpass', 500, 120, 0.7, 0.45); break;
      case 'screech': tone(0, 0.12, 'triangle', 1400, 900, 0.18); break;
      case 'spit': noise(0, 0.08, 'highpass', 2500, 1200, 0.8, 0.35); tone(0, 0.05, 'sine', 700, 400, 0.1); break;
      case 'boom': noise(0, 0.7, 'lowpass', 700, 90, 0.6, 0.9); tone(0, 0.45, 'sine', 110, 32, 0.6); break;
      case 'crash': noise(0, 0.32, 'bandpass', 900, 300, 0.9, 0.6); tone(0, 0.25, 'sine', 95, 40, 0.4); break;
      case 'ready': tone(0, 0.08, 'sine', 660, 880, 0.25); break;
      case 'ding': tone(0, 0.35, 'sine', 880, 870, 0.25); tone(0, 0.3, 'sine', 1320, 1310, 0.12); break;
      case 'horn': tone(0, 0.16, 'square', 392, 390, 0.11); tone(0.2, 0.22, 'square', 330, 328, 0.11); break;
      case 'level': [523, 659, 784].forEach((f, i) => tone(i * 0.08, 0.14, 'sine', f, f, 0.25)); break;
      case 'coin': tone(0, 0.08, 'sine', 1568, 1560, 0.2); tone(0.07, 0.14, 'sine', 2093, 2080, 0.18); break;
      case 'whoosh': noise(0, 0.28, 'bandpass', 400, 2200, 1.4, 0.45); break;
      case 'blast': noise(0, 0.5, 'lowpass', 900, 120, 0.7, 0.8); tone(0, 0.3, 'sine', 140, 40, 0.5); break;
      case 'win': [523, 659, 784, 1047].forEach((f, i) => tone(i * 0.13, 0.22, 'triangle', f, f, 0.3)); break;
      case 'lose': [392, 330, 262].forEach((f, i) => tone(i * 0.18, 0.3, 'triangle', f, f * 0.98, 0.28)); tone(0.55, 0.5, 'sine', 131, 120, 0.3); break;
      case 'tap': tone(0, 0.025, 'sine', 1200, 900, 0.08); break;
    }
    this.live++;
    this.played++;
    setTimeout(() => {
      this.live--;
      bus.disconnect();
    }, (length + 0.1) * 1000);
  }
}

function remembered(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

/** One for the whole app: the menu, a match and the next match share it. */
export const sfx = new Sfx();

export type { Voice };
