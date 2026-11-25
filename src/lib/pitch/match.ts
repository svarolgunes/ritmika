/**
 * The "match the note" game: sing or play the target note and hold it.
 * Any octave counts, so children and grown-ups can play together.
 */
import { centsFromPitchClass } from './notes';

/** The notes to match: the white keys from Do4 (middle C) to Do5. */
export const TONE_NOTES = [60, 62, 64, 65, 67, 69, 71, 72] as const;
export type ToneNote = (typeof TONE_NOTES)[number];

/** In tune within this many cents. */
export const MATCH_CENTS = 30;
/** Seconds the note must be held (in total; small wobbles only slow it down). */
export const MATCH_SECONDS = 1;

export type MatchState = { held: number; done: boolean };

export const NEW_MATCH: MatchState = { held: 0, done: false };

/** Advances the game by one pitch frame of length dt seconds. */
export function stepMatch(state: MatchState, midi: number | null, target: number, dt: number): MatchState {
  if (state.done || midi === null) return state;
  const off = Math.abs(centsFromPitchClass(midi, target));
  const held = off <= MATCH_CENTS ? state.held + dt : Math.max(0, state.held - dt * 0.5);
  return { held, done: held >= MATCH_SECONDS };
}

export type Hint = 'inTune' | 'higher' | 'lower';

/** What to tell the child: sing higher, lower, or that's it. */
export function matchHint(midi: number, target: number): Hint {
  const off = centsFromPitchClass(midi, target);
  if (Math.abs(off) <= MATCH_CENTS) return 'inTune';
  return off < 0 ? 'higher' : 'lower';
}
