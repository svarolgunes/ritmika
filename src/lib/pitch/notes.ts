/**
 * Note names and the maths between hertz, MIDI note numbers and cents.
 *
 * A MIDI number can be fractional: 69 is A4 exactly, 69.25 is A4 a quarter
 * of a semitone (25 cents) sharp. Everything on screen works in MIDI numbers,
 * because equal steps there are equal musical steps.
 */
import type { Lang } from '../i18n';

export const DEFAULT_A4 = 440;

export const NOTE_NAMES: Record<Lang, readonly string[]> = {
  tr: ['Do', 'Do♯', 'Re', 'Re♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si'],
  en: ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'],
};

/**
 * One colour per pitch class, in the rainbow order many children's
 * instruments (bells, boomwhackers) use, so Do is always red and so on.
 * Sharps take a darker shade of the note below.
 */
export const NOTE_COLORS: readonly string[] = [
  '#F25F5C', // Do
  '#C94643',
  '#FF8A5B', // Re
  '#D9693D',
  '#F5C33B', // Mi
  '#4CC38A', // Fa
  '#2F9E6A',
  '#3BB7D9', // Sol
  '#2290B0',
  '#7B6CF6', // La
  '#5B4BD6',
  '#D46BD8', // Si
];

const NATURAL = [true, false, true, false, true, true, false, true, false, true, false, true];

export function hzToMidi(hz: number, a4 = DEFAULT_A4): number {
  return 69 + 12 * Math.log2(hz / a4);
}

export function midiToHz(midi: number, a4 = DEFAULT_A4): number {
  return a4 * 2 ** ((midi - 69) / 12);
}

/** 0 = Do/C … 11 = Si/B, for any (also negative) note number. */
export function pitchClass(midi: number): number {
  return ((Math.round(midi) % 12) + 12) % 12;
}

export function isNatural(midi: number): boolean {
  return NATURAL[pitchClass(midi)];
}

/** Scientific octave: C4 is middle C (MIDI 60). */
export function octaveOf(midi: number): number {
  return Math.floor(Math.round(midi) / 12) - 1;
}

export function noteName(midi: number, lang: Lang): string {
  return NOTE_NAMES[lang][pitchClass(midi)];
}

export function noteColor(midi: number): string {
  return NOTE_COLORS[pitchClass(midi)];
}

export type NoteReading = {
  /** The nearest equal-tempered note. */
  midi: number;
  /** How far the sound is from it, −50 … +50; positive is sharp (too high). */
  cents: number;
};

export function nearestNote(midi: number): NoteReading {
  const nearest = Math.round(midi);
  return { midi: nearest, cents: (midi - nearest) * 100 };
}

/**
 * Cents from a target note, ignoring which octave it's sung in: a child
 * and a grown-up singing "the same" Do are an octave apart, and both count.
 * The result is in −600 … +600.
 */
export function centsFromPitchClass(midi: number, targetMidi: number): number {
  const d = (((midi - targetMidi) % 12) + 12) % 12; // 0 … 12
  return (d > 6 ? d - 12 : d) * 100;
}
