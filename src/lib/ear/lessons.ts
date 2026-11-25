/**
 * The training path: short lessons of ten questions, from "which note is
 * higher?" to seventh chords. Each one asks a little more than the last.
 * Within a unit, a lesson opens once the one before has earned a star; the
 * first lesson of every unit is always open.
 */
import type { GameConfig } from './game';

export const LESSON_LENGTH = 10;

export type UnitId = 'highLow' | 'notes' | 'intervals' | 'chords';

export type Lesson = {
  id: string;
  unit: UnitId;
  emoji: string;
  config: GameConfig;
};

export const UNITS: readonly UnitId[] = ['highLow', 'notes', 'intervals', 'chords'];

export const LESSONS: readonly Lesson[] = [
  { id: 'hl-big', unit: 'highLow', emoji: '🐘', config: { kind: 'compare', minGap: 7, maxGap: 12, allowSame: false } },
  { id: 'hl-mid', unit: 'highLow', emoji: '🐈', config: { kind: 'compare', minGap: 3, maxGap: 6, allowSame: false } },
  { id: 'hl-small', unit: 'highLow', emoji: '🐭', config: { kind: 'compare', minGap: 1, maxGap: 3, allowSame: true } },

  { id: 'n-do-sol', unit: 'notes', emoji: '🔴', config: { kind: 'note', pool: [0, 7], reference: true } },
  { id: 'n-do-mi-sol', unit: 'notes', emoji: '🟡', config: { kind: 'note', pool: [0, 4, 7], reference: true } },
  { id: 'n-do-re-mi', unit: 'notes', emoji: '🟠', config: { kind: 'note', pool: [0, 2, 4], reference: true } },
  { id: 'n-five', unit: 'notes', emoji: '🖐️', config: { kind: 'note', pool: [0, 2, 4, 5, 7], reference: true } },
  { id: 'n-upper', unit: 'notes', emoji: '🔵', config: { kind: 'note', pool: [5, 7, 9, 11, 12], reference: true } },
  { id: 'n-white', unit: 'notes', emoji: '🌈', config: { kind: 'note', pool: [0, 2, 4, 5, 7, 9, 11, 12], reference: true } },
  { id: 'n-all', unit: 'notes', emoji: '🎹', config: { kind: 'note', pool: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], reference: true } },

  { id: 'i-oct-5', unit: 'intervals', emoji: '🦒', config: { kind: 'interval', pool: [7, 12], direction: 'up' } },
  { id: 'i-thirds', unit: 'intervals', emoji: '🌗', config: { kind: 'interval', pool: [3, 4], direction: 'up' } },
  { id: 'i-perfect', unit: 'intervals', emoji: '🏰', config: { kind: 'interval', pool: [5, 7, 12], direction: 'up' } },
  { id: 'i-seconds', unit: 'intervals', emoji: '🐾', config: { kind: 'interval', pool: [1, 2], direction: 'up' } },
  { id: 'i-wide', unit: 'intervals', emoji: '🌉', config: { kind: 'interval', pool: [8, 9, 10, 11], direction: 'up' } },
  { id: 'i-all-up', unit: 'intervals', emoji: '🚀', config: { kind: 'interval', pool: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], direction: 'up' } },
  { id: 'i-down', unit: 'intervals', emoji: '🛝', config: { kind: 'interval', pool: [3, 4, 5, 7, 12], direction: 'down' } },
  { id: 'i-together', unit: 'intervals', emoji: '🤝', config: { kind: 'interval', pool: [3, 4, 5, 7, 12], direction: 'together' } },

  { id: 'c-major-minor-arp', unit: 'chords', emoji: '🌤️', config: { kind: 'chord', pool: ['major', 'minor'], style: 'arpeggio' } },
  { id: 'c-major-minor', unit: 'chords', emoji: '🎭', config: { kind: 'chord', pool: ['major', 'minor'], style: 'block' } },
  { id: 'c-four', unit: 'chords', emoji: '🎨', config: { kind: 'chord', pool: ['major', 'minor', 'dim', 'aug'], style: 'block' } },
  { id: 'c-sus', unit: 'chords', emoji: '🪁', config: { kind: 'chord', pool: ['major', 'sus2', 'sus4'], style: 'block' } },
  { id: 'c-sevenths', unit: 'chords', emoji: '✨', config: { kind: 'chord', pool: ['dom7', 'maj7', 'min7'], style: 'block' } },
  { id: 'c-all', unit: 'chords', emoji: '👑', config: { kind: 'chord', pool: ['major', 'minor', 'dim', 'aug', 'sus2', 'sus4', 'dom7', 'maj7', 'min7'], style: 'block' } },
];

export function lessonById(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id);
}

export function lessonsOf(unit: UnitId): Lesson[] {
  return LESSONS.filter((l) => l.unit === unit);
}

/** Open if it's the first of its unit or the lesson before it has a star. */
export function isUnlocked(lesson: Lesson, stars: Record<string, number>): boolean {
  const list = lessonsOf(lesson.unit);
  const i = list.indexOf(lesson);
  return i <= 0 || (stars[list[i - 1].id] ?? 0) >= 1;
}

/** The lesson after this one in its unit, if any. */
export function nextLesson(lesson: Lesson): Lesson | undefined {
  const list = lessonsOf(lesson.unit);
  return list[list.indexOf(lesson) + 1];
}
