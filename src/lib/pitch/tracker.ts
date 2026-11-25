/**
 * Turns a live stream of microphone samples into a steady pitch line.
 *
 * Samples arrive in buffers of any size at any sample rate. The tracker
 * low-passes and decimates them to about 16 kHz (plenty for fundamentals up
 * to 1.5 kHz, and a third of the work), keeps a sliding window, and every
 * hop runs the MPM detector on it. Each result then goes through:
 *
 * 1. A loudness and clarity gate, so silence, breath and room noise show
 *    nothing instead of a jumpy line.
 * 2. An onset check: a note must be found in two frames in a row before it
 *    appears, which removes single-frame blips from consonants and clicks.
 * 3. Octave-jump correction: a sudden jump of exactly an octave is only
 *    believed if it lasts, because that is the classic pitch-detector error.
 * 4. Light smoothing for small changes, while big changes (a new note) go
 *    through at once, so the line is calm but never lags behind a melody.
 */
import { PitchDetector, rms } from './mpm';
import { hzToMidi } from './notes';

export type PitchFrame = {
  /** Seconds since the tracker started (stream time, not wall clock). */
  t: number;
  /** null while nothing clear is heard. */
  hz: number | null;
  /** Fractional MIDI note number for hz (A4 = 69 at the given reference). */
  midi: number | null;
  clarity: number;
  /** Loudness of the frame in dBFS (0 is full scale). */
  db: number;
};

export type TrackerOptions = {
  minHz?: number;
  maxHz?: number;
  /** Quieter than this (dBFS) counts as silence. */
  minDb?: number;
  /** Less periodic than this counts as noise. */
  minClarity?: number;
  /** About how often a frame comes out, in seconds. */
  hop?: number;
  /** Reference pitch for A4, for the midi field. */
  a4?: number;
};

const TARGET_RATE = 16000;
const WINDOW_SECONDS = 0.064;
const ONSET_FRAMES = 2;
/** Frames an octave jump must last before it's believed. */
const OCTAVE_HOLD = 3;
/** Below this change (semitones) the line is smoothed; above it, it jumps. */
const SMOOTH_RANGE = 0.6;
const SMOOTHING = 0.45;

export class PitchTracker {
  private readonly opts: Required<TrackerOptions>;
  private inputRate = 0;
  private factor = 1;
  private rate = 0;
  private detector: PitchDetector | null = null;
  /** Ring buffer of the latest samples, and the window copied out of it in order. */
  private ring = new Float32Array(0);
  private pos = 0;
  private window = new Float32Array(0);
  private filled = 0;
  private sinceHop = 0;
  private hopSize = 0;
  /** Decimation state: running sum of input samples and how many are in it. */
  private acc = 0;
  private accCount = 0;
  /** Two-pole low-pass ahead of decimation, against aliasing. */
  private lp1 = 0;
  private lp2 = 0;
  private lpAlpha = 1;
  private samplesOut = 0;

  private candidate: { midi: number; frames: number } | null = null;
  private current: number | null = null;
  private octaveSuspect: { midi: number; frames: number } | null = null;

  constructor(options: TrackerOptions = {}) {
    this.opts = {
      minHz: options.minHz ?? 60,
      maxHz: options.maxHz ?? 1500,
      minDb: options.minDb ?? -50,
      minClarity: options.minClarity ?? 0.8,
      hop: options.hop ?? 0.04,
      a4: options.a4 ?? 440,
    };
  }

  /** Changes the A4 reference; the line already shown keeps its pitch. */
  setA4(value: number) {
    if (value === this.opts.a4) return;
    const shift = hzToMidi(this.opts.a4, value) - 69; // same sound, new numbering
    this.opts.a4 = value;
    if (this.current !== null) this.current += shift;
    if (this.candidate) this.candidate.midi += shift;
    if (this.octaveSuspect) this.octaveSuspect.midi += shift;
  }

  /** Forgets the line, e.g. after the mic was off for a while. */
  reset() {
    this.candidate = null;
    this.current = null;
    this.octaveSuspect = null;
    this.filled = 0;
    this.sinceHop = 0;
  }

  private setup(sampleRate: number) {
    this.inputRate = sampleRate;
    this.factor = Math.max(1, Math.round(sampleRate / TARGET_RATE));
    this.rate = sampleRate / this.factor;
    const size = Math.round(this.rate * WINDOW_SECONDS);
    this.detector = new PitchDetector({ sampleRate: this.rate, size, minHz: this.opts.minHz, maxHz: this.opts.maxHz });
    this.window = new Float32Array(size);
    this.ring = new Float32Array(size);
    this.pos = 0;
    this.hopSize = Math.max(1, Math.round(this.rate * this.opts.hop));
    // Cut-off a little under the new Nyquist frequency.
    const cutoff = (0.4 * this.rate) / sampleRate;
    this.lpAlpha = this.factor === 1 ? 1 : 1 - Math.exp(-2 * Math.PI * cutoff);
    this.filled = 0;
    this.sinceHop = 0;
    this.acc = 0;
    this.accCount = 0;
  }

  /** Feeds samples (−1 … 1); returns the frames they completed, oldest first. */
  push(samples: ArrayLike<number>, sampleRate: number): PitchFrame[] {
    if (sampleRate !== this.inputRate) this.setup(sampleRate);
    const out: PitchFrame[] = [];
    const { factor, lpAlpha, ring } = this;
    const size = ring.length;
    for (let i = 0; i < samples.length; i += 1) {
      let v = samples[i];
      if (factor > 1) {
        this.lp1 += lpAlpha * (v - this.lp1);
        this.lp2 += lpAlpha * (this.lp1 - this.lp2);
        this.acc += this.lp2;
        this.accCount += 1;
        if (this.accCount < factor) continue;
        v = this.acc / factor;
        this.acc = 0;
        this.accCount = 0;
      }
      this.samplesOut += 1;
      ring[this.pos] = v;
      this.pos = (this.pos + 1) % size;
      if (this.filled < size) this.filled += 1;
      this.sinceHop += 1;
      if (this.filled === size && this.sinceHop >= this.hopSize) {
        this.sinceHop = 0;
        out.push(this.analyse());
      }
    }
    return out;
  }

  private analyse(): PitchFrame {
    const t = this.samplesOut / this.rate;
    const { ring, window, pos } = this;
    window.set(ring.subarray(pos), 0);
    window.set(ring.subarray(0, pos), ring.length - pos);
    const level = rms(this.window);
    const db = level > 0 ? 20 * Math.log10(level) : -120;
    const estimate = db >= this.opts.minDb ? this.detector!.detect(this.window) : null;
    const clarity = estimate?.clarity ?? 0;
    const heard =
      estimate && clarity >= this.opts.minClarity && estimate.hz >= this.opts.minHz && estimate.hz <= this.opts.maxHz
        ? hzToMidi(estimate.hz, this.opts.a4)
        : null;
    const midi = this.follow(heard);
    return { t, hz: midi === null ? null : this.opts.a4 * 2 ** ((midi - 69) / 12), midi, clarity, db };
  }

  /** Steps 2–4 above. */
  private follow(heard: number | null): number | null {
    if (heard === null) {
      this.candidate = null;
      this.octaveSuspect = null;
      this.current = null;
      return null;
    }

    if (this.current === null) {
      if (this.candidate && Math.abs(this.candidate.midi - heard) < 1) {
        this.candidate = { midi: heard, frames: this.candidate.frames + 1 };
      } else {
        this.candidate = { midi: heard, frames: 1 };
      }
      if (this.candidate.frames < ONSET_FRAMES) return null;
      this.candidate = null;
      this.current = heard;
      return heard;
    }

    const jump = heard - this.current;
    const octaveJump = Math.abs(Math.abs(jump) - 12) < 0.8 || Math.abs(Math.abs(jump) - 24) < 0.8;
    if (octaveJump) {
      if (this.octaveSuspect && Math.abs(this.octaveSuspect.midi - heard) < 1) {
        this.octaveSuspect = { midi: heard, frames: this.octaveSuspect.frames + 1 };
      } else {
        this.octaveSuspect = { midi: heard, frames: 1 };
      }
      if (this.octaveSuspect.frames < OCTAVE_HOLD) {
        // Most likely the same note read an octave off: keep the line where it is.
        return this.current;
      }
      this.octaveSuspect = null;
      this.current = heard;
      return heard;
    }
    this.octaveSuspect = null;

    this.current = Math.abs(jump) < SMOOTH_RANGE ? this.current + SMOOTHING * jump : heard;
    return this.current;
  }
}
