import type { AudioCore } from '../../sound/core';
import { biquad, rand } from '../../sound/dsp';

// ---- The dog ----------------------------------------------------------------------------------

/** A few gruff woofs from where the dog is. */
export function bark(a: AudioCore, x: number, z: number, times: number) {
  const ctx = a.ctx;
  if (!ctx) return;
  a.count('bark');
  const out = a.panner({ x, y: 0.5, z }, 2, 1);
  out.connect(a.ambience);
  let t = ctx.currentTime + 0.03;
  const pitch = rand(0.95, 1.05);
  for (let i = 0; i < times; i++) {
    woof(a, out, t, 300 * pitch * rand(0.95, 1.05), 0.17, 0.55);
    t += rand(0.3, 0.42);
  }
}

/** A short, high, happy yip: someone petted the dog. */
export function yip(a: AudioCore, x: number, z: number) {
  const ctx = a.ctx;
  if (!ctx) return;
  a.count('yip');
  const out = a.panner({ x, y: 0.5, z }, 1.5, 1);
  out.connect(a.ambience);
  woof(a, out, ctx.currentTime + 0.02, 620, 0.09, 0.3);
}

/** One bark: a buzzy voice that leaps up in pitch and falls away, shaped into a "wuh", with a breathy rasp. */
function woof(a: AudioCore, out: AudioNode, t: number, f: number, len: number, gain: number) {
  const ctx = a.ctx!;
  const voice = ctx.createOscillator();
  voice.type = 'sawtooth';
  voice.frequency.setValueAtTime(f * 0.75, t);
  voice.frequency.exponentialRampToValueAtTime(f * 1.45, t + len * 0.22);
  voice.frequency.exponentialRampToValueAtTime(f * 0.6, t + len);
  const mouth = biquad(ctx, 'bandpass', 950, 1.1);
  mouth.frequency.setValueAtTime(700, t);
  mouth.frequency.linearRampToValueAtTime(1300, t + len * 0.3);
  mouth.frequency.linearRampToValueAtTime(600, t + len);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(gain * 0.45, t + len * 0.5);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  voice.connect(mouth).connect(g).connect(out);
  const breath = a.noise(a.buf.white);
  const rasp = ctx.createGain();
  rasp.gain.value = 0.35;
  breath.connect(biquad(ctx, 'bandpass', 1800, 0.8)).connect(rasp).connect(g);
  voice.start(t);
  voice.stop(t + len + 0.02);
  breath.start(t, rand(0, 4));
  breath.stop(t + len + 0.02);
}

// ---- The cat ----------------------------------------------------------------------------------

/** A few meows from where the cat is: the dog's bark, for a floor whose pet is the cat. */
export function meow(a: AudioCore, x: number, z: number, times: number) {
  const ctx = a.ctx;
  if (!ctx) return;
  a.count('meow');
  const out = a.panner({ x, y: 0.4, z }, 2, 1);
  out.connect(a.ambience);
  let t = ctx.currentTime + 0.03;
  const pitch = rand(0.93, 1.07);
  for (let i = 0; i < times; i++) {
    const len = rand(0.45, 0.6);
    miaow(a, out, t, 560 * pitch * rand(0.95, 1.05), len, 0.4);
    t += len + rand(0.25, 0.4);
  }
}

/** A short, soft, high mew: someone petted the cat. */
export function mew(a: AudioCore, x: number, z: number) {
  const ctx = a.ctx;
  if (!ctx) return;
  a.count('mew');
  const out = a.panner({ x, y: 0.4, z }, 1.5, 1);
  out.connect(a.ambience);
  miaow(a, out, ctx.currentTime + 0.02, 820, 0.22, 0.22);
}

/** One meow: a reedy voice that rises and falls, its mouth opening from an "ee" to an "ow". */
function miaow(a: AudioCore, out: AudioNode, t: number, f: number, len: number, gain: number) {
  const ctx = a.ctx!;
  const voice = ctx.createOscillator();
  voice.type = 'sawtooth';
  voice.frequency.setValueAtTime(f * 0.85, t);
  voice.frequency.exponentialRampToValueAtTime(f * 1.25, t + len * 0.35);
  voice.frequency.exponentialRampToValueAtTime(f * 0.7, t + len);
  const mouth = biquad(ctx, 'bandpass', 1800, 2.2);
  mouth.frequency.setValueAtTime(2200, t);
  mouth.frequency.linearRampToValueAtTime(1500, t + len * 0.4);
  mouth.frequency.linearRampToValueAtTime(800, t + len);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + len * 0.15);
  g.gain.setValueAtTime(gain, t + len * 0.55);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  voice.connect(mouth).connect(g).connect(out);
  voice.start(t);
  voice.stop(t + len + 0.02);
}
