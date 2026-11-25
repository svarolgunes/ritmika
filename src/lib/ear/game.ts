/**
 * Ear-training games: guess which note, which interval (two notes) or which
 * chord was played on the piano, or simply whether the second note was
 * higher or lower. Everything here is pure, so it is easy to test; the
 * screen plays the notes and keeps the score.
 */

/** Middle C, Do4. The single-note game is played from here up to Do5. */
export const DO4 = 60;

/** The piano samples go from Sol2 to Do6 (scripts/sounds/piano.py). */
export const PIANO_LOW = 43;
export const PIANO_HIGH = 84;

export type GameKind = 'compare' | 'note' | 'interval' | 'chord';

/** Semitones above the bottom note. */
export const CHORDS = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  dom7: [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
} as const;
export type ChordId = keyof typeof CHORDS;
export const CHORD_IDS = Object.keys(CHORDS) as ChordId[];

/** Interval sizes in semitones: 0 is the same note, 12 the octave. */
export const INTERVALS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

/** Note offsets from Do4 for the single-note game: Do … Si and the high Do. */
export const NOTE_OFFSETS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
export const WHITE_OFFSETS = [0, 2, 4, 5, 7, 9, 11, 12] as const;

export type Direction = 'up' | 'down' | 'together' | 'mixed';
export type ChordStyle = 'arpeggio' | 'block';
export type CompareAnswer = 'up' | 'down' | 'same';

export type GameConfig =
  | { kind: 'compare'; minGap: number; maxGap: number; allowSame: boolean }
  /** pool: offsets from Do4; reference: Do4 is played first, as a starting point. */
  | { kind: 'note'; pool: number[]; reference: boolean }
  | { kind: 'interval'; pool: number[]; direction: Direction }
  | { kind: 'chord'; pool: ChordId[]; style: ChordStyle };

/** How the notes of a question are played. */
export type Playback = {
  /** Groups of notes played one after another; notes in one group sound together. */
  steps: number[][];
  /** Milliseconds from one step to the next. */
  gap: number;
};

export type Question = {
  kind: GameKind;
  /** The answer's id: a direction, an offset, a semitone count or a chord id. */
  answer: string;
  /** Every answer button, in a fixed order. */
  choices: string[];
  playback: Playback;
  /** Every note heard, for the keyboard shown after answering. */
  notes: number[];
  /** The note the question is built on (bottom of an interval or chord). */
  root: number;
  /** For intervals: which way the notes were played. */
  direction?: Exclude<Direction, 'mixed'>;
  /** For the single-note game: the reference note played first, if any. */
  reference?: number;
};

export type Rng = () => number;

function pick<T>(items: readonly T[], rng: Rng): T {
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
}

function randInt(lo: number, hi: number, rng: Rng): number {
  return lo + Math.min(hi - lo, Math.floor(rng() * (hi - lo + 1)));
}

const MELODIC_GAP = 800;
const ARPEGGIO_GAP = 380;

export function choicesFor(config: GameConfig): string[] {
  switch (config.kind) {
    case 'compare':
      return config.allowSame ? ['up', 'same', 'down'] : ['up', 'down'];
    case 'note':
    case 'interval':
      return [...config.pool].sort((a, b) => a - b).map(String);
    case 'chord':
      return CHORD_IDS.filter((c) => config.pool.includes(c));
  }
}

/** Notes and playback for one answer, built on a given root, so any answer can be heard and compared. */
export function soundOf(config: GameConfig, answer: string, root: number, direction: Exclude<Direction, 'mixed'> = 'up'): Pick<Question, 'playback' | 'notes'> {
  switch (config.kind) {
    case 'compare': {
      // root is the first note; the answer only says where the second one went.
      return { playback: { steps: [[root]], gap: MELODIC_GAP }, notes: [root] };
    }
    case 'note': {
      const note = DO4 + Number(answer);
      const steps = config.reference ? [[DO4], [note]] : [[note]];
      return { playback: { steps, gap: MELODIC_GAP + 200 }, notes: config.reference ? [DO4, note] : [note] };
    }
    case 'interval': {
      const size = Number(answer);
      const top = direction === 'down' ? root : root + size;
      const bottom = direction === 'down' ? root - size : root;
      if (direction === 'together') return { playback: { steps: [[bottom, top]], gap: MELODIC_GAP }, notes: [bottom, top] };
      const steps = direction === 'down' ? [[top], [bottom]] : [[bottom], [top]];
      return { playback: { steps, gap: MELODIC_GAP }, notes: [bottom, top] };
    }
    case 'chord': {
      const notes = CHORDS[answer as ChordId].map((i) => root + i);
      const steps = config.style === 'arpeggio' ? [...notes.map((n) => [n]), notes] : [notes];
      return { playback: { steps, gap: ARPEGGIO_GAP }, notes };
    }
  }
}

/** Makes a new question; avoids playing exactly the same notes as the previous one. */
export function makeQuestion(config: GameConfig, rng: Rng = Math.random, previous?: Question | null): Question {
  for (let tries = 0; ; tries += 1) {
    const q = makeOne(config, rng);
    const same = previous && q.answer === previous.answer && q.notes.join() === previous.notes.join();
    if (!same || tries >= 8) return q;
  }
}

function makeOne(config: GameConfig, rng: Rng): Question {
  const choices = choicesFor(config);
  switch (config.kind) {
    case 'compare': {
      const answer = pick(choices, rng) as CompareAnswer;
      const gap = answer === 'same' ? 0 : randInt(config.minGap, config.maxGap, rng);
      // Both notes stay between Sol3 and Re5, where a phone speaker sounds best.
      const firstNote = answer === 'down' ? randInt(55 + gap, 74, rng) : randInt(55, 74 - gap, rng);
      const second = answer === 'up' ? firstNote + gap : answer === 'down' ? firstNote - gap : firstNote;
      return {
        kind: 'compare',
        answer,
        choices,
        playback: { steps: [[firstNote], [second]], gap: MELODIC_GAP },
        notes: [firstNote, second],
        root: firstNote,
      };
    }
    case 'note': {
      const answer = pick(choices, rng);
      return { kind: 'note', answer, choices, root: DO4 + Number(answer), reference: config.reference ? DO4 : undefined, ...soundOf(config, answer, DO4) };
    }
    case 'interval': {
      const answer = pick(choices, rng);
      const size = Number(answer);
      const direction: Exclude<Direction, 'mixed'> = config.direction === 'mixed' ? pick(['up', 'down', 'together'] as const, rng) : config.direction;
      // Keep both notes in the comfortable middle of the piano, Do3 … Sol5.
      const lo = 48;
      const hi = 79;
      const root = direction === 'down' ? randInt(lo + size, hi, rng) : randInt(lo, hi - size, rng);
      const sound = soundOf(config, answer, root, direction);
      return { kind: 'interval', answer, choices, root: Math.min(...sound.notes), direction, ...sound };
    }
    case 'chord': {
      const answer = pick(choices, rng);
      const root = randInt(48, 62, rng);
      return { kind: 'chord', answer, choices, root, ...soundOf(config, answer, root) };
    }
  }
}

/** The sound of another answer to the same question, so a child can compare what they picked with what it was. */
export function soundOfChoice(config: GameConfig, q: Question, choice: string): Pick<Question, 'playback' | 'notes'> | null {
  switch (config.kind) {
    case 'compare':
      return null;
    case 'note':
      return soundOf(config, choice, DO4);
    case 'interval': {
      const dir = q.direction ?? 'up';
      // Keep the note the interval starts from, as a singer would.
      const start = dir === 'down' ? Math.max(...q.notes) : Math.min(...q.notes);
      const size = Number(choice);
      const fits = dir === 'down' ? start - size >= PIANO_LOW : start + size <= PIANO_HIGH;
      return soundOf(config, choice, fits ? start : dir === 'down' ? start + 12 : start - 12, dir);
    }
    case 'chord':
      return soundOf(config, choice, q.root);
  }
}

/** Stars for a finished lesson of `total` questions. */
export function starsFor(correct: number, total: number): number {
  const ratio = total > 0 ? correct / total : 0;
  if (ratio >= 1) return 3;
  if (ratio >= 0.8) return 2;
  if (ratio >= 0.6) return 1;
  return 0;
}

export function totalDuration(p: Playback): number {
  return (p.steps.length - 1) * p.gap;
}
