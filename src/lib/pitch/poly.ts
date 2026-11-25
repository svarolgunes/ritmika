/**
 * Several pitches at once (chords, two voices, piano), by iterative
 * estimation and cancellation of harmonic sums.
 *
 * A. Klapuri, "Multiple fundamental frequency estimation by summing
 * harmonic amplitudes", ISMIR 2006. For one window it:
 *
 * 1. takes a Hann-windowed magnitude spectrum and whitens it (each region
 *    is divided by a power of its local average), so loud low notes don't
 *    drown quiet high ones and the timbre matters less than the pitch;
 * 2. scores every candidate fundamental f0 by the weighted sum of the
 *    spectrum at its harmonics, s(f0) = Σ g(f0, m) · max Y(around m·f0),
 *    with g = (f0 + α) / (m·f0 + β) favouring the low harmonics;
 * 3. takes the best candidate as one note, removes its harmonics from the
 *    spectrum, and scores again, until adding a note no longer pays off
 *    (the polyphony estimate) or the next note is too weak.
 *
 * The removal step is what makes a chord come out as its notes rather
 * than as its root plus octave mistakes. Two notes exactly an octave apart
 * share every harmonic of the upper one, so they come out as one.
 */
import { FFT } from './mpm';
import { hzToMidi } from './notes';

export type PolyNote = {
  hz: number;
  /** Harmonic-sum score; only meaningful relative to the other notes. */
  salience: number;
  /** Salience over what a flat (noise-like) spectrum would score at this f0. */
  contrast: number;
};

export type PolyOptions = {
  sampleRate: number;
  /** Window length in samples; a power of two. */
  size: number;
  minHz: number;
  maxHz: number;
  maxNotes?: number;
  /** A further note must score at least this share of the strongest one. */
  minShare?: number;
  /** Every note must score this many times what noise would (see PolyNote.contrast). */
  minContrast?: number;
};

const ALPHA = 52; // Hz, Klapuri's g(f0, m) constants
const BETA = 320;
const CANCEL = 0.89;
const GAMMA = 0.3; // polyphony estimate exponent (gentler than the paper's, which suits its own scaling)
const STEPS_PER_SEMITONE = 3;
const MAX_HARMONICS = 12;

export class PolyDetector {
  private readonly opts: Required<PolyOptions>;
  private readonly n: number;
  private readonly binHz: number;
  private readonly hann: Float64Array;
  private readonly re: Float64Array;
  private readonly im: Float64Array;
  private readonly mag: Float64Array;
  private readonly env: Float64Array;
  private readonly residual: Float64Array;
  private readonly fft: FFT;
  private readonly prefix: Float64Array;
  /** Whitening window per bin: about a third of an octave, at least ±3 bins. */
  private readonly envLo: Int32Array;
  private readonly envHi: Int32Array;
  private readonly envInv: Float64Array;
  /** Candidate fundamentals on a log grid. */
  private readonly cands: Float64Array;
  private readonly sal: Float64Array;
  /** Per candidate: where its harmonics' bin ranges and weights start in the flat tables below. */
  private readonly hStart: Int32Array;
  private readonly hLo: Int32Array;
  private readonly hHi: Int32Array;
  private readonly hW: Float64Array;
  private readonly wSum: Float64Array;

  constructor(options: PolyOptions) {
    this.opts = { maxNotes: 4, minShare: 0.15, minContrast: 5, ...options };
    const { size, sampleRate, minHz, maxHz } = this.opts;
    this.n = size * 2; // zero-padded for finer bins
    this.binHz = sampleRate / this.n;
    this.hann = new Float64Array(size).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1)));
    this.fft = new FFT(this.n);
    this.re = new Float64Array(this.n);
    this.im = new Float64Array(this.n);
    this.mag = new Float64Array(this.n / 2);
    this.env = new Float64Array(this.n / 2);
    this.residual = new Float64Array(this.n / 2);
    this.prefix = new Float64Array(this.n / 2 + 1);
    const half = this.n / 2;
    this.envLo = new Int32Array(half);
    this.envHi = new Int32Array(half);
    this.envInv = new Float64Array(half);
    for (let k = 0; k < half; k += 1) {
      const w = Math.max(3, Math.round(k * 0.12));
      this.envLo[k] = Math.max(0, k - w);
      this.envHi[k] = Math.min(half, k + w + 1);
      this.envInv[k] = 1 / (this.envHi[k] - this.envLo[k]);
    }
    const lo = hzToMidi(minHz);
    const count = Math.floor((hzToMidi(maxHz) - lo) * STEPS_PER_SEMITONE) + 1;
    this.cands = new Float64Array(count).map((_, i) => 440 * 2 ** ((lo + i / STEPS_PER_SEMITONE - 69) / 12));
    this.sal = new Float64Array(count);

    // Precompute every candidate's harmonic bins and weights, so scoring is a tight loop.
    const nyq = sampleRate / 2 - this.binHz * 2;
    const los: number[] = [];
    const his: number[] = [];
    const ws: number[] = [];
    this.hStart = new Int32Array(count + 1);
    this.wSum = new Float64Array(count);
    for (let i = 0; i < count; i += 1) {
      this.hStart[i] = los.length;
      const f0 = this.cands[i];
      for (let m = 1; m <= MAX_HARMONICS && m * f0 <= nyq; m += 1) {
        const [a, b] = this.range(m * f0);
        los.push(a);
        his.push(b);
        const g = (f0 + ALPHA) / (m * f0 + BETA);
        ws.push(g);
        this.wSum[i] += g;
      }
    }
    this.hStart[count] = los.length;
    this.hLo = Int32Array.from(los);
    this.hHi = Int32Array.from(his);
    this.hW = Float64Array.from(ws);
  }

  /** Salience of candidate i: its precomputed harmonic sum. */
  private candSalience(i: number, spec: Float64Array): number {
    const { hStart, hLo, hHi, hW } = this;
    let s = 0;
    for (let h = hStart[i], end = hStart[i + 1]; h < end; h += 1) {
      let best = 0;
      for (let k = hLo[h], b = hHi[h]; k <= b; k += 1) if (spec[k] > best) best = spec[k];
      s += hW[h] * best;
    }
    return s;
  }

  private spectrum(x: ArrayLike<number>) {
    const { re, im, mag, env, hann, n } = this;
    const size = hann.length;
    let mean = 0;
    for (let i = 0; i < size; i += 1) mean += x[i];
    mean /= size;
    for (let i = 0; i < n; i += 1) {
      re[i] = i < size ? (x[i] - mean) * hann[i] : 0;
      im[i] = 0;
    }
    this.fft.transform(re, im);
    const half = n / 2;
    for (let k = 0; k < half; k += 1) mag[k] = Math.sqrt(re[k] * re[k] + im[k] * im[k]);

    // Whitening: divide by the local average (via a running sum), raised to 0.67.
    const { prefix, envLo, envHi, envInv } = this;
    prefix[0] = 0;
    let peak = 0;
    for (let k = 0; k < half; k += 1) {
      const m = mag[k];
      prefix[k + 1] = prefix[k] + m;
      if (m > peak) peak = m;
    }
    const floor = peak * 1e-4 + 1e-12;
    for (let k = 0; k < half; k += 1) env[k] = (prefix[envHi[k]] - prefix[envLo[k]]) * envInv[k];
    // env is smooth, so its power is taken every 8 bins and interpolated between.
    const residual = this.residual;
    let prevK = 0;
    let prevG = Math.pow(env[0] > floor ? env[0] : floor, -0.67);
    for (let k = 8; k < half + 8; k += 8) {
      const kk = Math.min(k, half - 1);
      const g = Math.pow(env[kk] > floor ? env[kk] : floor, -0.67);
      const span = kk - prevK || 1;
      for (let i = prevK; i < kk || (kk === half - 1 && i === kk); i += 1) residual[i] = mag[i] * (prevG + ((g - prevG) * (i - prevK)) / span);
      prevK = kk;
      prevG = g;
      if (kk === half - 1) break;
    }
  }

  /** Bins searched for harmonic m of f0: a little either side, for grid spacing and string stiffness. */
  private range(f: number): [number, number] {
    const c = f / this.binHz;
    const w = Math.max(1, c * 0.012);
    return [Math.max(1, Math.floor(c - w)), Math.min(this.mag.length - 1, Math.ceil(c + w))];
  }

  private salience(f0: number, spec: Float64Array): number {
    let s = 0;
    const nyq = this.opts.sampleRate / 2 - this.binHz * 2;
    for (let m = 1; m <= MAX_HARMONICS; m += 1) {
      const f = m * f0;
      if (f > nyq) break;
      const [a, b] = this.range(f);
      let best = 0;
      for (let k = a; k <= b; k += 1) if (spec[k] > best) best = spec[k];
      s += ((f0 + ALPHA) / (m * f0 + BETA)) * best;
    }
    return s;
  }

  private peak(f: number, spec: Float64Array): number {
    const [a, b] = this.range(f);
    let best = 0;
    for (let k = a; k <= b; k += 1) best = Math.max(best, spec[k]);
    return best;
  }

  /**
   * Fine-tunes f0 from the exact peaks of its first few partials (where
   * string stiffness hardly stretches them), each interpolated between
   * bins, weighted by strength.
   */
  private refine(f0: number): number {
    const { mag, binHz } = this;
    let num = 0;
    let den = 0;
    for (let m = 1; m <= 4; m += 1) {
      const [a, b] = this.range(m * f0);
      let k = a;
      for (let i = a; i <= b; i += 1) if (mag[i] > mag[k]) k = i;
      if (k <= 0 || k >= mag.length - 1 || mag[k] <= mag[k - 1] || mag[k] < mag[k + 1]) continue;
      const y0 = Math.log(mag[k - 1] + 1e-12);
      const y1 = Math.log(mag[k] + 1e-12);
      const y2 = Math.log(mag[k + 1] + 1e-12);
      const d = y0 - 2 * y1 + y2;
      const shift = d !== 0 ? (0.5 * (y0 - y2)) / d : 0;
      const w = mag[k] / m;
      num += w * (((k + shift) * binHz) / m);
      den += w;
    }
    return den > 0 ? num / den : f0;
  }

  /** The notes sounding in one window, strongest first. */
  detect(x: ArrayLike<number>): PolyNote[] {
    this.spectrum(x);
    const { cands, sal, residual, opts } = this;
    // The whitened spectrum's typical level, from the band the notes live in.
    const sorted = residual.slice(this.range(opts.minHz)[0], this.range(Math.min(opts.sampleRate / 2.2, opts.maxHz * 4))[1]).sort();
    const typical = sorted[Math.floor(sorted.length * 0.5)] + 1e-12;
    const notes: PolyNote[] = [];
    let sum = 0;
    let lastScore = 0;
    for (let j = 1; j <= opts.maxNotes; j += 1) {
      let best = -1;
      for (let i = 0; i < cands.length; i += 1) {
        sal[i] = this.candSalience(i, residual);
        if (best < 0 || sal[i] > sal[best]) best = i;
      }
      if (best < 0 || sal[best] <= 0) break;
      if (notes.length && sal[best] < opts.minShare * notes[0].salience) break;
      // The polyphony estimate: stop when another note no longer raises it.
      const score = (sum + sal[best]) / j ** GAMMA;
      if (j > 1 && score <= lastScore * 0.85) break;
      sum += sal[best];
      lastScore = score;

      // Refine between grid points with a parabola through the neighbours.
      let f0 = cands[best];
      if (best > 0 && best < cands.length - 1) {
        const y0 = sal[best - 1];
        const y1 = sal[best];
        const y2 = sal[best + 1];
        const d = y0 - 2 * y1 + y2;
        const shift = d !== 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (y0 - y2)) / d)) : 0;
        f0 = 440 * 2 ** ((hzToMidi(cands[best]) + shift / STEPS_PER_SEMITONE - 69) / 12);
      }
      // A chord's other notes share (and so cancel) many harmonics of a lower
      // note, leaving only some of them, which then look like a higher note
      // (its octave, or its twelfth). If there is real energy at f0/2 or f0/3
      // (that lower note's own fundamental) and it scores nearly as well,
      // take the lower note instead.
      for (const k of [3, 2]) {
        const sub = f0 / k;
        if (sub < opts.minHz || notes.some((n) => Math.abs(hzToMidi(n.hz) - hzToMidi(sub)) < 0.5)) continue;
        if (this.peak(sub, residual) >= 0.6 * this.peak(f0, residual) && this.salience(sub, residual) >= 0.6 * sal[best]) {
          f0 = sub;
          break;
        }
      }
      f0 = this.refine(f0);
      const contrast = sal[best] / (typical * this.wSum[best]);
      if (contrast < opts.minContrast) break;
      notes.push({ hz: f0, salience: sal[best], contrast });

      // Cancel its harmonics: remove the weighted partial around each m·f0.
      const nyq = opts.sampleRate / 2 - this.binHz * 2;
      for (let m = 1; m <= 24; m += 1) {
        const f = m * f0;
        if (f > nyq) break;
        const g = Math.min(1, ((f0 + ALPHA) / (m * f0 + BETA)) * 10);
        // Wider than the search, and wider for higher partials, which a
        // stiff string stretches sharp.
        const c = f / this.binHz;
        const w = 2 + c * (0.006 + 0.0002 * Math.min(m, 12) ** 2);
        const a = Math.floor(c - w);
        const b = Math.ceil(c + w * 1.5);
        if (a >= residual.length) break;
        for (let k = a; k <= b; k += 1) {
          if (k < 0 || k >= residual.length) continue;
          residual[k] = Math.max(0, residual[k] * (1 - CANCEL * g));
        }
      }
    }
    return notes;
  }
}
