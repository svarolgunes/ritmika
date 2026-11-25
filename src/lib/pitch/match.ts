/**
 * The "match the note" game: pick an octave and a note, then sing or play
 * exactly that pitch and hold it. Only the chosen octave counts: Do3 is not Do4.
 */

/** Octaves to choose from (scientific numbering: Do4 is middle C). */
export const MATCH_OCTAVES = [2, 3, 4] as const;
export type MatchOctave = (typeof MATCH_OCTAVES)[number];
export const DEFAULT_OCTAVE: MatchOctave = 4;

const WHITE_KEYS = [0, 2, 4, 5, 7, 9, 11];

/** The notes of one octave to match: Do Re Mi Fa Sol La Si and the next Do. */
export function scaleNotes(octave: number): number[] {
  const doNote = 12 * (octave + 1);
  return [...WHITE_KEYS.map((k) => doNote + k), doNote + 12];
}

/** Every note that has a reference tone: Do2 … Do5. */
export const TONE_NOTES: readonly number[] = [...new Set(MATCH_OCTAVES.flatMap(scaleNotes))];

/** In tune within this many cents. */
export const MATCH_CENTS = 30;
/** Seconds the note must be held (in total; small wobbles only slow it down). */
export const MATCH_SECONDS = 1;

export type MatchState = { held: number; done: boolean };

export const NEW_MATCH: MatchState = { held: 0, done: false };

/** Cents from the exact target note; positive is too high. */
export function centsFromTarget(midi: number, target: number): number {
  return (midi - target) * 100;
}

/** Advances the game by one pitch frame of length dt seconds. */
export function stepMatch(state: MatchState, midi: number | null, target: number, dt: number): MatchState {
  if (state.done || midi === null) return state;
  const off = Math.abs(centsFromTarget(midi, target));
  const held = off <= MATCH_CENTS ? state.held + dt : Math.max(0, state.held - dt * 0.5);
  return { held, done: held >= MATCH_SECONDS };
}

export type Hint = 'inTune' | 'higher' | 'lower' | 'octaveUp' | 'octaveDown';

/**
 * What to tell the child: that's it, a bit higher or lower, or, when the
 * right note is sung in the wrong octave, to go up or down an octave.
 */
export function matchHint(midi: number, target: number): Hint {
  const off = centsFromTarget(midi, target);
  if (Math.abs(off) <= MATCH_CENTS) return 'inTune';
  const octaves = Math.round(off / 1200);
  if (octaves !== 0 && Math.abs(off - octaves * 1200) <= MATCH_CENTS) return octaves < 0 ? 'octaveUp' : 'octaveDown';
  return off < 0 ? 'higher' : 'lower';
}
