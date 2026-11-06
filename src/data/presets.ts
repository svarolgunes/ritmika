/**
 * Example rhythms. Patterns use a tiny text notation, one bar per `|`:
 *   w h q e s  = whole, half, quarter, eighth, sixteenth
 *   a trailing `.` makes it dotted, a leading `-` makes it a rest.
 * `npm test` checks that every bar of every preset adds up exactly.
 */
import { makeEvent, TIME_SIGNATURES, timeSigKey, type Bar, type NoteValue, type TimeSig } from '../lib/rhythm';
import { emptyStaff, type Song } from '../lib/song';
import type { InstrumentId } from './instruments';

const LETTERS: Record<string, NoteValue> = { w: 1, h: 2, q: 4, e: 8, s: 16 };

export function parsePattern(pattern: string): Bar[] {
  return pattern.split('|').map((bar) =>
    bar
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((token) => {
        const rest = token.startsWith('-');
        const dotted = token.endsWith('.');
        const letter = token.replace(/^-/, '').replace(/\.$/, '');
        const value = LETTERS[letter];
        if (!value) throw new Error(`Unknown note "${token}"`);
        return makeEvent(value, { rest, dotted });
      }),
  );
}

function sigOf(key: string): TimeSig {
  const sig = TIME_SIGNATURES.find((s) => timeSigKey(s) === key);
  if (!sig) throw new Error(`Unknown time signature ${key}`);
  return sig;
}

export type Preset = {
  id: string;
  name: { tr: string; en: string };
  sig: string;
  tempo: number;
  parts: { instrument: InstrumentId; pattern: string }[];
};

export const SOLO_PRESETS: Preset[] = [
  {
    id: 'quarters',
    name: { tr: 'Dörtlükler', en: 'Quarter notes' },
    sig: '4/4',
    tempo: 80,
    parts: [{ instrument: 'woodblock', pattern: 'q q q q | q q h' }],
  },
  {
    id: 'eighths',
    name: { tr: 'Sekizlikler', en: 'Eighth notes' },
    sig: '4/4',
    tempo: 80,
    parts: [{ instrument: 'clap', pattern: 'e e e e q q | e e q e e q' }],
  },
  {
    id: 'rests',
    name: { tr: 'Sus ile', en: 'With rests' },
    sig: '4/4',
    tempo: 84,
    parts: [{ instrument: 'drum', pattern: 'q -q q -q | h -h | q q -q q | w' }],
  },
  {
    id: 'gallop',
    name: { tr: 'Dörtnala', en: 'Gallop' },
    sig: '2/4',
    tempo: 76,
    parts: [{ instrument: 'castanets', pattern: 'e. s e. s | e. s q | s s s s e. s | q -q' }],
  },
  {
    id: 'waltz',
    name: { tr: 'Vals', en: 'Waltz' },
    sig: '3/4',
    tempo: 120,
    parts: [{ instrument: 'triangle', pattern: 'h q | q q q | h. | -q q q' }],
  },
  {
    id: 'sixeight',
    name: { tr: 'Salıncak (6/8)', en: 'Swing boat (6/8)' },
    sig: '6/8 (3+3)',
    tempo: 160,
    parts: [{ instrument: 'tambourine', pattern: 'q e q e | q. q. | e e e q e | q. -q.' }],
  },
  {
    id: 'aksak7',
    name: { tr: 'Aksak 7/8', en: 'Aksak 7/8' },
    sig: '7/8 (2+2+3)',
    tempo: 220,
    parts: [{ instrument: 'darbuka', pattern: 'q q q. | e e e e e e e' }],
  },
];

export const ENSEMBLE_PRESETS: Preset[] = [
  {
    id: 'rock',
    name: { tr: 'Rock', en: 'Rock' },
    sig: '4/4',
    tempo: 100,
    parts: [
      { instrument: 'hihat', pattern: 'e e e e e e e e | e e e e e e e e' },
      { instrument: 'snare', pattern: '-q q -q q | -q q -q e e' },
      { instrument: 'drum', pattern: 'q -q e e -q | q -e e e e -q' },
    ],
  },
  {
    id: 'karsilama',
    name: { tr: 'Karşılama 9/8', en: 'Karşılama 9/8' },
    sig: '9/8 (2+2+2+3)',
    tempo: 230,
    parts: [
      { instrument: 'darbuka', pattern: 'q e e q q. | q e e q e e e' },
      { instrument: 'tambourine', pattern: 'e e e e e e e e e | e e e e e e e e e' },
      { instrument: 'drum', pattern: 'q -q q -q. | q -q q -q.' },
    ],
  },
  {
    id: 'carnival',
    name: { tr: 'Karnaval', en: 'Carnival' },
    sig: '2/4',
    tempo: 104,
    parts: [
      { instrument: 'cowbell', pattern: 'e e -e e | e -e e e' },
      { instrument: 'maracas', pattern: 'e. s e. s | e. s e. s' },
      { instrument: 'tambourine', pattern: 's s s s s s s s | s s s s s s s s' },
      { instrument: 'drum', pattern: 'q q | q q' },
    ],
  },
  {
    id: 'waltz-band',
    name: { tr: 'Vals Bandosu', en: 'Waltz band' },
    sig: '3/4',
    tempo: 132,
    parts: [
      { instrument: 'triangle', pattern: 'h. | -h q' },
      { instrument: 'clap', pattern: '-q q q | -q q q' },
      { instrument: 'drum', pattern: 'q -h | q -h' },
    ],
  },
];

export function songFromPreset(preset: Preset): Song {
  const parts = preset.parts.map((p) => ({ ...p, bars: parsePattern(p.pattern) }));
  const length = Math.max(...parts.map((p) => p.bars.length));
  return {
    tempo: preset.tempo,
    sig: sigOf(preset.sig),
    staves: parts.map((p) => {
      const staff = emptyStaff(p.instrument, length);
      return { ...staff, bars: staff.bars.map((empty, i) => p.bars[i] ?? empty) };
    }),
  };
}
