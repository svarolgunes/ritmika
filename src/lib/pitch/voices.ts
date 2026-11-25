/**
 * Follows several pitches over time as separate lines ("voices").
 *
 * Each frame brings a handful of detected notes. Each is joined to the line
 * that was nearest to it in the frame before, if it is close enough (under
 * JOIN semitones); otherwise it starts a new line. So a line never jumps a
 * big step: a leap ends one line and starts another, while a glide or
 * vibrato, which moves only a little from frame to frame, stays one line.
 *
 * A new line appears only once it is found in two frames running, which
 * removes one-frame ghosts. A line that drops out for a moment is held at
 * its last pitch for up to `maxGap` seconds before it ends. The dominant
 * line is the one with the strongest (smoothed) salience.
 */

export type DetectedNote = { midi: number; salience: number };

export type Voice = {
  /** Stays the same for the whole life of a line. */
  id: number;
  midi: number;
  /** Salience relative to the dominant line, 0 … 1. */
  strength: number;
  dominant: boolean;
};

/** Furthest a line may move between two frames, in semitones. */
export const JOIN = 0.8;
const ONSET_FRAMES = 2;

type Track = { id: number; midi: number; salience: number; frames: number; missing: number };

export class VoiceTracker {
  private tracks: Track[] = [];
  private nextId = 1;
  private readonly maxMissing: number;

  constructor(hop: number, maxGap = 0.12) {
    this.maxMissing = Math.max(1, Math.round(maxGap / hop));
  }

  reset() {
    this.tracks = [];
  }

  /** Shifts every line, e.g. when the A4 reference changes. */
  shift(semitones: number) {
    for (const t of this.tracks) t.midi += semitones;
  }

  step(notes: DetectedNote[]): Voice[] {
    const free = new Set(this.tracks);
    const born: Track[] = [];
    for (const note of [...notes].sort((a, b) => b.salience - a.salience)) {
      let best: Track | null = null;
      for (const t of free) {
        const d = Math.abs(t.midi - note.midi);
        if (d < JOIN && (!best || d < Math.abs(best.midi - note.midi))) best = t;
      }
      if (best) {
        free.delete(best);
        const d = note.midi - best.midi;
        // Small wobbles are smoothed; real moves within JOIN go through.
        best.midi += Math.abs(d) < 0.15 ? 0.4 * d : d;
        best.salience = 0.6 * best.salience + 0.4 * note.salience;
        best.frames += 1;
        best.missing = 0;
      } else {
        born.push({ id: this.nextId++, midi: note.midi, salience: note.salience, frames: 1, missing: 0 });
      }
    }
    // Lines not heard this frame: hold them for a moment, then end them.
    this.tracks = this.tracks.filter((t) => {
      if (!free.has(t)) return true;
      t.missing += 1;
      t.salience *= 0.8;
      return t.frames >= ONSET_FRAMES && t.missing <= this.maxMissing;
    });
    this.tracks.push(...born);

    const visible = this.tracks.filter((t) => t.frames >= ONSET_FRAMES);
    if (!visible.length) return [];
    const top = visible.reduce((a, b) => (b.salience > a.salience ? b : a));
    return visible
      .map((t) => ({ id: t.id, midi: t.midi, strength: Math.min(1, t.salience / top.salience), dominant: t === top }))
      .sort((a, b) => b.strength - a.strength);
  }
}
