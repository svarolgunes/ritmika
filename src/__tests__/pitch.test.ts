import { describe, expect, it } from '@jest/globals';

import { PitchDetector } from '../lib/pitch/mpm';
import { PolyDetector } from '../lib/pitch/poly';
import { centsFromPitchClass, hzToMidi, midiToHz, nearestNote, noteName, octaveOf, pitchClass } from '../lib/pitch/notes';
import { matchHint, MATCH_OCTAVES, NEW_MATCH, scaleNotes, stepMatch, TONE_NOTES } from '../lib/pitch/match';
import { PitchTracker, type PitchFrame } from '../lib/pitch/tracker';

const SR = 48000;

/** A deterministic noise source, so the tests never flake. */
function lcg(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 31 - 1;
  };
}

type Partial = { mult: number; amp: number };

function tone(hz: number | ((t: number) => number), seconds: number, partials: Partial[] = [{ mult: 1, amp: 1 }], level = 0.5, noise = 0) {
  const n = Math.round(SR * seconds);
  const out = new Float32Array(n);
  const rand = lcg(7);
  let phase = 0;
  for (let i = 0; i < n; i += 1) {
    const f = typeof hz === 'number' ? hz : hz(i / SR);
    phase += (2 * Math.PI * f) / SR;
    let v = 0;
    for (const p of partials) v += p.amp * Math.sin(p.mult * phase);
    out[i] = level * v + noise * rand();
  }
  return out;
}

/** Feeds a signal in phone-sized buffers and returns every frame. */
function track(signal: Float32Array, tracker = new PitchTracker(), buffer = 1024): PitchFrame[] {
  const frames: PitchFrame[] = [];
  for (let i = 0; i < signal.length; i += buffer) frames.push(...tracker.push(signal.subarray(i, i + buffer), SR));
  return frames;
}

const cents = (a: number, b: number) => 1200 * Math.log2(a / b);
const voiced = (frames: PitchFrame[]) => frames.filter((f) => f.hz !== null);

/** The median pitch over the steady part of a tracked tone. */
function steadyHz(frames: PitchFrame[]) {
  const hz = voiced(frames)
    .slice(3)
    .map((f) => f.hz!)
    .sort((a, b) => a - b);
  return hz[Math.floor(hz.length / 2)];
}

// A sung vowel: strong low harmonics that fall off, like a voice.
const VOICE: Partial[] = [
  { mult: 1, amp: 0.6 },
  { mult: 2, amp: 1 },
  { mult: 3, amp: 0.7 },
  { mult: 4, amp: 0.4 },
  { mult: 5, amp: 0.25 },
  { mult: 6, amp: 0.15 },
];

describe('note maths', () => {
  it('converts between hertz and note numbers', () => {
    expect(hzToMidi(440)).toBeCloseTo(69, 6);
    expect(hzToMidi(261.6256)).toBeCloseTo(60, 3);
    expect(midiToHz(81)).toBeCloseTo(880, 6);
    expect(hzToMidi(432, 432)).toBeCloseTo(69, 6);
    expect(hzToMidi(440, 432)).toBeGreaterThan(69);
  });

  it('names notes in Turkish and English', () => {
    expect(noteName(60, 'tr')).toBe('Do');
    expect(noteName(67, 'tr')).toBe('Sol');
    expect(noteName(71, 'tr')).toBe('Si');
    expect(noteName(69, 'en')).toBe('A');
    expect(noteName(61, 'en')).toBe('C♯');
    expect(octaveOf(60)).toBe(4);
    expect(octaveOf(59)).toBe(3);
    expect(pitchClass(-1)).toBe(11);
  });

  it('measures cents to the nearest note', () => {
    const r = nearestNote(69.23);
    expect(r.midi).toBe(69);
    expect(r.cents).toBeCloseTo(23, 6);
    expect(nearestNote(68.6).cents).toBeCloseTo(-40, 6);
  });

  it('compares with a target in any octave', () => {
    expect(centsFromPitchClass(48.1, 60)).toBeCloseTo(10, 6);
    expect(centsFromPitchClass(71.8, 60)).toBeCloseTo(-20, 6);
    expect(centsFromPitchClass(64, 60)).toBeCloseTo(400, 6);
  });
});

describe('MPM detector', () => {
  const detector = new PitchDetector({ sampleRate: 16000, size: 1024, minHz: 60, maxHz: 1500 });
  const window = (hz: number, partials?: Partial[]) => {
    const rate = 16000;
    const x = new Float32Array(1024);
    for (let i = 0; i < x.length; i += 1) {
      const ph = (2 * Math.PI * hz * i) / rate;
      x[i] = (partials ?? [{ mult: 1, amp: 1 }]).reduce((s, p) => s + p.amp * Math.sin(p.mult * ph), 0);
    }
    return x;
  };

  it.each([65.4, 110, 196, 261.63, 440, 523.25, 880, 1318.5])('finds a pure %f Hz tone within 3 cents', (hz) => {
    const r = detector.detect(window(hz))!;
    expect(Math.abs(cents(r.hz, hz))).toBeLessThan(3);
    expect(r.clarity).toBeGreaterThan(0.95);
  });

  it.each([98, 220, 330, 587])('finds the fundamental of a voice-like %f Hz tone, not an octave above', (hz) => {
    const r = detector.detect(window(hz, VOICE))!;
    expect(Math.abs(cents(r.hz, hz))).toBeLessThan(5);
  });

  it('finds a missing fundamental, as the ear does', () => {
    const r = detector.detect(window(150, [{ mult: 2, amp: 1 }, { mult: 3, amp: 1 }, { mult: 4, amp: 0.8 }]))!;
    expect(Math.abs(cents(r.hz, 150))).toBeLessThan(5);
  });

  it('returns nothing for silence', () => {
    expect(detector.detect(new Float32Array(1024))).toBeNull();
  });

  it('gives noise a low clarity', () => {
    const rand = lcg(3);
    const x = new Float32Array(1024).map(() => rand());
    const r = detector.detect(x);
    expect(r === null || r.clarity < 0.6).toBe(true);
  });
});

describe('pitch tracker', () => {
  it.each([110, 220, 349.23, 440, 880])('tracks a sung %f Hz note from 48 kHz input', (hz) => {
    const frames = track(tone(hz, 0.6, VOICE, 0.3, 0.01));
    expect(voiced(frames).length).toBeGreaterThan(8);
    expect(Math.abs(cents(steadyHz(frames), hz))).toBeLessThan(5);
  });

  it('works at 44.1 kHz too', () => {
    const tracker = new PitchTracker();
    const n = Math.round(44100 * 0.5);
    const x = new Float32Array(n).map((_, i) => 0.4 * Math.sin((2 * Math.PI * 293.66 * i) / 44100));
    const frames: PitchFrame[] = [];
    for (let i = 0; i < n; i += 512) frames.push(...tracker.push(x.subarray(i, i + 512), 44100));
    expect(Math.abs(cents(steadyHz(frames), 293.66))).toBeLessThan(5);
  });

  it('produces about 40 frames a second', () => {
    const frames = track(tone(440, 1));
    expect(frames.length).toBeGreaterThanOrEqual(36);
    expect(frames.length).toBeLessThanOrEqual(41);
  });

  it('shows nothing for silence, quiet hiss or loud noise', () => {
    expect(voiced(track(new Float32Array(SR)))).toHaveLength(0);
    expect(voiced(track(tone(440, 1, [], 0, 0.002)))).toHaveLength(0);
    expect(voiced(track(tone(440, 1, [], 0, 0.5))).length).toBeLessThanOrEqual(1);
  });

  it('follows a melody, note by note', () => {
    const notes = [261.63, 293.66, 329.63, 349.23, 392];
    const signal = new Float32Array(notes.length * SR * 0.4);
    notes.forEach((hz, k) => signal.set(tone(hz, 0.4, VOICE, 0.3), k * SR * 0.4));
    const frames = track(signal);
    notes.forEach((hz, k) => {
      const inNote = frames.filter((f) => f.hz && f.t > k * 0.4 + 0.15 && f.t < (k + 1) * 0.4 - 0.02);
      expect(inNote.length).toBeGreaterThan(2);
      for (const f of inNote) expect(Math.abs(cents(f.hz!, hz))).toBeLessThan(15);
    });
  });

  it('follows a glide and vibrato smoothly', () => {
    const glide = (t: number) => 220 * 2 ** t + 6 * Math.sin(2 * Math.PI * 5.5 * t);
    const frames = voiced(track(tone(glide, 1, VOICE, 0.3)));
    expect(frames.length).toBeGreaterThan(18);
    for (const f of frames.slice(2)) expect(Math.abs(cents(f.hz!, glide(f.t - 0.032)))).toBeLessThan(40);
  });

  it('bridges short dropouts in a held note, but ends at real silence', () => {
    // A held Sol3 with a 100 ms hole in the middle, then 400 ms of silence.
    const a = tone(196, 0.5, VOICE, 0.3);
    const b = tone(196, 0.5, VOICE, 0.3);
    const signal = new Float32Array(a.length + SR * 0.1 + b.length + SR * 0.4);
    signal.set(a);
    signal.set(b, a.length + SR * 0.1);
    const frames = track(signal);
    const during = frames.filter((f) => f.t > 0.15 && f.t < 1.08);
    expect(during.every((f) => f.hz !== null && Math.abs(cents(f.hz, 196)) < 10)).toBe(true);
    expect(frames.filter((f) => f.t > 1.35).every((f) => f.hz === null)).toBe(true);
  });

  it('keeps following a note through a breathy, noisy stretch', () => {
    const rand = lcg(11);
    const x = tone(330, 1.2, VOICE, 0.3);
    // From 0.4 s to 0.8 s the tone fades and gets much noisier, as at the end of a breath.
    for (let i = Math.round(0.4 * SR); i < 0.8 * SR; i += 1) x[i] = x[i] * 0.25 + 0.05 * rand();
    const frames = track(x).filter((f) => f.t > 0.2);
    const voicedShare = frames.filter((f) => f.hz !== null).length / frames.length;
    expect(voicedShare).toBeGreaterThan(0.95);
    for (const f of voiced(frames)) expect(Math.abs(cents(f.hz!, 330))).toBeLessThan(25);
  });

  it('keeps a steady note steady', () => {
    const rand = lcg(5);
    // Noisy enough that raw readings jitter.
    const x = tone(261.63, 1, VOICE, 0.2).map((v) => v + 0.03 * rand());
    const hz = voiced(track(x)).slice(4).map((f) => f.hz!);
    const spread = Math.max(...hz.map((h) => Math.abs(cents(h, 261.63))));
    expect(spread).toBeLessThan(6);
  });

  it('ignores a one-frame octave slip', () => {
    const tracker = new PitchTracker();
    // Steady A3, then a few windows of its octave, then back.
    const a = tone(220, 0.5, VOICE, 0.3);
    const slip = tone(440, 0.07, [{ mult: 1, amp: 1 }], 0.3);
    const b = tone(220, 0.3, VOICE, 0.3);
    const signal = new Float32Array(a.length + slip.length + b.length);
    signal.set(a);
    signal.set(slip, a.length);
    signal.set(b, a.length + slip.length);
    const frames = voiced(track(signal, tracker));
    for (const f of frames.slice(3)) expect(Math.abs(cents(f.hz!, 220))).toBeLessThan(60);
  });

  it('renumbers notes when the A4 reference changes', () => {
    const at440 = steadyHz(track(tone(440, 0.4), new PitchTracker({ a4: 440 })));
    const frames = track(tone(440, 0.4), new PitchTracker({ a4: 432 }));
    const midi = voiced(frames).slice(-1)[0].midi!;
    expect(Math.abs(cents(at440, 440))).toBeLessThan(5);
    expect(midi).toBeCloseTo(hzToMidi(440, 432), 1);
  });
});

describe('match the note', () => {
  it('fills up only while the exact note, in the chosen octave, is held in tune', () => {
    let s = NEW_MATCH;
    for (let i = 0; i < 30; i += 1) s = stepMatch(s, 48.1, 60, 0.04); // Do3 is not Do4
    expect(s.held).toBe(0);
    for (let i = 0; i < 10; i += 1) s = stepMatch(s, 60.1, 60, 0.04);
    expect(s.held).toBeCloseTo(0.4, 6);
    expect(s.done).toBe(false);
    for (let i = 0; i < 15; i += 1) s = stepMatch(s, 59.8, 60, 0.04);
    expect(s.done).toBe(true);
  });

  it('drains slowly when off, and waits during silence', () => {
    let s = stepMatch(NEW_MATCH, 60, 60, 0.5);
    s = stepMatch(s, 61, 60, 0.2);
    expect(s.held).toBeCloseTo(0.4, 6);
    expect(stepMatch(s, null, 60, 1)).toBe(s);
  });

  it('says which way to go, including a whole octave', () => {
    expect(matchHint(59.5, 60)).toBe('higher');
    expect(matchHint(60.5, 60)).toBe('lower');
    expect(matchHint(60.2, 60)).toBe('inTune');
    expect(matchHint(72.1, 60)).toBe('octaveDown');
    expect(matchHint(47.9, 60)).toBe('octaveUp');
    expect(matchHint(35.9, 60)).toBe('octaveUp');
    expect(matchHint(53, 60)).toBe('higher');
  });

  it('offers Do to Do in octaves 2, 3 and 4', () => {
    expect(scaleNotes(2)).toEqual([36, 38, 40, 41, 43, 45, 47, 48]);
    expect(scaleNotes(4)).toEqual([60, 62, 64, 65, 67, 69, 71, 72]);
    expect(MATCH_OCTAVES).toEqual([2, 3, 4]);
    expect(TONE_NOTES).toHaveLength(22);
    expect(noteName(scaleNotes(3)[4], 'tr')).toBe('Sol');
    expect(octaveOf(scaleNotes(3)[4])).toBe(3);
  });
});

describe('reference tones', () => {
  // Node's fs, without needing @types/node for this one test.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs: { readFileSync(p: string): Uint8Array & { buffer: ArrayBuffer; byteOffset: number } } = require('fs');

  it.each([...TONE_NOTES])('tone-%i.wav is in tune at A4 = 440', (note) => {
    const buf = fs.readFileSync(`assets/sounds/tone-${note}.wav`);
    const rate = new DataView(buf.buffer, buf.byteOffset, 44).getUint32(24, true);
    const pcm = new Int16Array(buf.buffer.slice(buf.byteOffset + 44, buf.byteOffset + buf.length));
    const x = Float32Array.from(pcm, (v) => v / 32768);
    const tracker = new PitchTracker();
    const frames: PitchFrame[] = [];
    for (let i = 0; i < x.length; i += 1024) frames.push(...tracker.push(x.subarray(i, i + 1024), rate));
    expect(Math.abs(cents(steadyHz(frames), midiToHz(note)))).toBeLessThan(8);
  });
});

describe('several notes at once', () => {
  /** A piano-like note: slightly stretched partials, the higher ones weaker. */
  const pianoPartials = (n: number): Partial[] =>
    Array.from({ length: n }, (_, i) => ({ mult: (i + 1) * Math.sqrt(1 + 0.0004 * (i + 1) ** 2), amp: 1 / (i + 1) ** 0.9 }));
  const chord = (midis: number[], seconds: number, level = 0.12) => {
    const out = new Float32Array(Math.round(SR * seconds));
    midis.forEach((m) => {
      const t = tone(midiToHz(m), seconds, pianoPartials(10), level);
      for (let i = 0; i < out.length; i += 1) out[i] += t[i];
    });
    return out;
  };
  const polyTrack = (signal: Float32Array) => track(signal, new PitchTracker({ poly: true }));
  const notesAt = (f: PitchFrame) => (f.voices ?? []).map((v) => Math.round(v.midi)).sort((a, b) => a - b);

  it.each([[60], [36], [60, 64, 67], [48, 64], [57, 60, 64], [60, 64, 67, 71], [62, 65], [43, 71], [48, 55, 64], [72, 76, 79]])(
    'detector reads the chord %p exactly',
    (...midis: number[]) => {
      const d = new PolyDetector({ sampleRate: 16000, size: 2048, minHz: 60, maxHz: 1500 });
      const x = new Float32Array(2048);
      midis.forEach((m, j) => {
        for (const p of pianoPartials(12)) {
          const f = midiToHz(m) * p.mult;
          if (f > 7500) break;
          for (let i = 0; i < x.length; i += 1) x[i] += p.amp * Math.sin((2 * Math.PI * f * i) / 16000 + p.mult + j);
        }
      });
      const found = d.detect(x).map((n) => hzToMidi(n.hz));
      expect(found.map(Math.round).sort((a, b) => a - b)).toEqual([...midis].sort((a, b) => a - b));
      for (const f of found) expect(Math.abs(f - Math.round(f))).toBeLessThan(0.05);
    },
  );

  it('finds each note of a held chord as its own steady line', () => {
    const frames = polyTrack(chord([60, 64, 67], 0.8)).filter((f) => f.t > 0.25);
    expect(frames.length).toBeGreaterThan(15);
    const exact = frames.filter((f) => notesAt(f).join() === '60,64,67');
    expect(exact.length / frames.length).toBeGreaterThan(0.9);
    // The same three lines all the way through, never re-started.
    const ids = new Set(frames.flatMap((f) => (f.voices ?? []).map((v) => v.id)));
    expect(ids.size).toBe(3);
    for (const f of exact) for (const v of f.voices!) expect(Math.abs(v.midi - Math.round(v.midi))).toBeLessThan(0.08);
  });

  it('marks exactly one line as dominant, the loudest', () => {
    const loud = tone(midiToHz(67), 0.6, pianoPartials(10), 0.25);
    const soft = tone(midiToHz(55), 0.6, pianoPartials(10), 0.06);
    const frames = polyTrack(loud.map((v, i) => v + soft[i])).filter((f) => f.t > 0.25 && (f.voices?.length ?? 0) === 2);
    expect(frames.length).toBeGreaterThan(8);
    for (const f of frames) {
      expect(f.voices!.filter((v) => v.dominant)).toHaveLength(1);
      expect(Math.round(f.voices!.find((v) => v.dominant)!.midi)).toBe(67);
      expect(f.voices!.find((v) => !v.dominant)!.strength).toBeLessThan(1);
    }
  });

  it('ends a line at a big leap and starts a new one, instead of jumping', () => {
    const signal = new Float32Array(Math.round(SR * 1.2));
    signal.set(chord([60], 0.6));
    signal.set(chord([67], 0.6), Math.round(SR * 0.6));
    const frames = polyTrack(signal);
    const lines = new Map<number, number[]>();
    for (const f of frames) for (const v of f.voices ?? []) lines.set(v.id, [...(lines.get(v.id) ?? []), v.midi]);
    expect(lines.size).toBeGreaterThanOrEqual(2);
    // No line ever moves more than a fraction of a semitone between frames.
    for (const midis of lines.values()) for (let i = 1; i < midis.length; i += 1) expect(Math.abs(midis[i] - midis[i - 1])).toBeLessThan(0.8);
  });

  it('finds one line for a single sung note, and none for noise', () => {
    const sung = polyTrack(tone(220, 0.6, VOICE, 0.3)).filter((f) => f.t > 0.25);
    expect(sung.filter((f) => notesAt(f).join() === '57').length / sung.length).toBeGreaterThan(0.9);
    const noise = polyTrack(tone(440, 0.6, [], 0, 0.3));
    expect(noise.filter((f) => (f.voices?.length ?? 0) > 0).length).toBeLessThanOrEqual(1);
  });

  it('stays light enough for a phone', () => {
    const x = chord([48, 60, 64, 67], 4);
    const start = Date.now();
    polyTrack(x);
    // 4 s of audio; on a laptop this is well under a tenth of real time.
    expect(Date.now() - start).toBeLessThan(300);
  });
});
