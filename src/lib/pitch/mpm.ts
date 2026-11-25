/**
 * Pitch detection with the McLeod Pitch Method (MPM).
 *
 * P. McLeod and G. Wyvill, "A smarter way to find pitch", ICMC 2005. It is
 * the method behind the Tartini tuner and many singing apps: it is accurate
 * for voices and for instruments, and rarely jumps an octave.
 *
 * For a window x of N samples it computes the normalised square difference
 * function
 *
 *   n(τ) = 2·r(τ) / m(τ),  r(τ) = Σ x[j]·x[j+τ],  m(τ) = Σ x[j]² + x[j+τ]²
 *
 * which is 1 at lags where the signal repeats itself exactly. The pitch
 * period is the first "key maximum" of n that comes close to the highest
 * one, refined between samples with a parabola. The height of that peak,
 * the clarity, says how periodic (how "note-like") the sound is.
 *
 * r(τ) is found for every lag at once with an FFT, so one window costs
 * O(N log N): about a millisecond on a phone for the sizes used here.
 */

export type PitchEstimate = {
  /** Fundamental frequency in Hz. */
  hz: number;
  /** Peak height of the NSDF, 0 … 1: how clearly periodic the window is. */
  clarity: number;
};

export type DetectorOptions = {
  sampleRate: number;
  /** Window length in samples (a power of two is fastest but not required). */
  size: number;
  minHz: number;
  maxHz: number;
  /** A key maximum this close to the highest one wins (the paper's k). */
  cutoff?: number;
};

/** In-place iterative radix-2 FFT on separate real and imaginary arrays. */
export class FFT {
  readonly n: number;
  private readonly rev: Uint32Array;
  private readonly cos: Float64Array;
  private readonly sin: Float64Array;

  constructor(n: number) {
    if (n & (n - 1)) throw new Error('FFT size must be a power of two');
    this.n = n;
    const bits = Math.log2(n);
    this.rev = new Uint32Array(n);
    for (let i = 0; i < n; i += 1) {
      let r = 0;
      for (let b = 0; b < bits; b += 1) r |= ((i >> b) & 1) << (bits - 1 - b);
      this.rev[i] = r;
    }
    this.cos = new Float64Array(n / 2);
    this.sin = new Float64Array(n / 2);
    for (let i = 0; i < n / 2; i += 1) {
      this.cos[i] = Math.cos((-2 * Math.PI * i) / n);
      this.sin[i] = Math.sin((-2 * Math.PI * i) / n);
    }
  }

  /** Forward transform; for the inverse, conjugate before and after. */
  transform(re: Float64Array, im: Float64Array) {
    const { n, rev, cos, sin } = this;
    for (let i = 0; i < n; i += 1) {
      const j = rev[i];
      if (j > i) {
        let t = re[i];
        re[i] = re[j];
        re[j] = t;
        t = im[i];
        im[i] = im[j];
        im[j] = t;
      }
    }
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1;
      const step = n / size;
      for (let start = 0; start < n; start += size) {
        for (let k = 0; k < half; k += 1) {
          const wr = cos[k * step];
          const wi = sin[k * step];
          const a = start + k;
          const b = a + half;
          const xr = re[b] * wr - im[b] * wi;
          const xi = re[b] * wi + im[b] * wr;
          re[b] = re[a] - xr;
          im[b] = im[a] - xi;
          re[a] += xr;
          im[a] += xi;
        }
      }
    }
  }
}

export class PitchDetector {
  readonly sampleRate: number;
  readonly size: number;
  private readonly minLag: number;
  private readonly maxLag: number;
  private readonly cutoff: number;
  private readonly fft: FFT;
  private readonly re: Float64Array;
  private readonly im: Float64Array;
  /** The NSDF of the last window, kept for inspection and tests. */
  readonly nsdf: Float64Array;

  constructor({ sampleRate, size, minHz, maxHz, cutoff = 0.9 }: DetectorOptions) {
    this.sampleRate = sampleRate;
    this.size = size;
    this.cutoff = cutoff;
    this.minLag = Math.max(2, Math.floor(sampleRate / maxHz));
    this.maxLag = Math.min(size - 2, Math.ceil(sampleRate / minHz));
    let n = 1;
    while (n < size * 2) n <<= 1;
    this.fft = new FFT(n);
    this.re = new Float64Array(n);
    this.im = new Float64Array(n);
    this.nsdf = new Float64Array(this.maxLag + 2);
  }

  /** Finds the pitch of one window of `size` samples, or null if there is none. */
  detect(x: ArrayLike<number>): PitchEstimate | null {
    const { size, re, im, nsdf, maxLag, minLag } = this;
    const n = this.fft.n;

    // Remove any DC offset, which would otherwise look like a very low note.
    let mean = 0;
    for (let i = 0; i < size; i += 1) mean += x[i];
    mean /= size;

    // Autocorrelation r(τ) = IFFT(|FFT(x)|²), with zero padding to 2N.
    let energy = 0;
    for (let i = 0; i < n; i += 1) {
      const v = i < size ? x[i] - mean : 0;
      re[i] = v;
      im[i] = 0;
      energy += v * v;
    }
    if (energy < 1e-10) return null;
    this.fft.transform(re, im);
    for (let i = 0; i < n; i += 1) {
      re[i] = re[i] * re[i] + im[i] * im[i];
      im[i] = 0;
    }
    this.fft.transform(re, im); // the power spectrum is real and even, so forward = inverse · n

    // m(τ) shrinks by the two samples that drop out of the overlap at each lag.
    let m = 2 * energy;
    const at = (i: number) => x[i] - mean;
    nsdf[0] = 1;
    for (let tau = 1; tau <= maxLag + 1; tau += 1) {
      const a = at(tau - 1);
      const b = at(size - tau);
      m -= a * a + b * b;
      nsdf[tau] = m > 1e-12 ? (2 * re[tau]) / n / m : 0;
    }

    // Key maxima: the highest point between each upward and downward zero crossing.
    const peaks: number[] = [];
    let tau = 1;
    while (tau < maxLag && nsdf[tau] > 0) tau += 1; // skip the lobe around lag 0
    let best = -1;
    let inLobe = false;
    for (; tau <= maxLag; tau += 1) {
      const v = nsdf[tau];
      if (!inLobe && v > 0 && nsdf[tau - 1] <= 0) {
        inLobe = true;
        best = -1;
      }
      if (inLobe) {
        if (v <= 0) {
          if (best > 0) peaks.push(best);
          inLobe = false;
        } else if (tau >= minLag && (best < 0 || v > nsdf[best])) {
          best = tau;
        }
      }
    }
    if (inLobe && best > 0 && best < maxLag) peaks.push(best);
    if (!peaks.length) return null;

    let highest = 0;
    for (const p of peaks) highest = Math.max(highest, nsdf[p]);
    if (highest <= 0) return null;
    const threshold = this.cutoff * highest;
    const chosen = peaks.find((p) => nsdf[p] >= threshold) ?? peaks[0];

    // Parabolic interpolation through the peak and its neighbours.
    const y0 = nsdf[chosen - 1];
    const y1 = nsdf[chosen];
    const y2 = nsdf[chosen + 1];
    const denom = y0 - 2 * y1 + y2;
    const shift = denom !== 0 ? (0.5 * (y0 - y2)) / denom : 0;
    const period = chosen + Math.max(-0.5, Math.min(0.5, shift));
    const clarity = Math.min(1, y1 - 0.25 * (y0 - y2) * shift);

    return { hz: this.sampleRate / period, clarity };
  }
}

/** Root-mean-square level of a window. */
export function rms(x: ArrayLike<number>, length = x.length): number {
  let sum = 0;
  for (let i = 0; i < length; i += 1) sum += x[i] * x[i];
  return Math.sqrt(sum / Math.max(1, length));
}
