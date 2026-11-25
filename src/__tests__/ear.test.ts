import { describe, expect, it } from '@jest/globals';

import { CHORDS, choicesFor, DO4, makeQuestion, PIANO_HIGH, PIANO_LOW, soundOfChoice, starsFor, type GameConfig, type Question } from '../lib/ear/game';
import { choiceLabel } from '../lib/ear/labels';
import { isUnlocked, LESSONS, lessonsOf, nextLesson, UNITS } from '../lib/ear/lessons';
import { EAR_STRINGS } from '../lib/ear/strings';

function lcg(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function many(config: GameConfig, n = 400): Question[] {
  const rng = lcg(3);
  const out: Question[] = [];
  let prev: Question | null = null;
  for (let i = 0; i < n; i += 1) {
    prev = makeQuestion(config, rng, prev);
    out.push(prev);
  }
  return out;
}

const allNotes = (q: Question) => q.playback.steps.flat();

describe('questions', () => {
  it('higher or lower: the second note goes the way the answer says', () => {
    for (const q of many({ kind: 'compare', minGap: 1, maxGap: 12, allowSame: true })) {
      const [[a], [b]] = q.playback.steps;
      expect(q.answer).toBe(b > a ? 'up' : b < a ? 'down' : 'same');
      if (q.answer !== 'same') expect(Math.abs(b - a)).toBeGreaterThanOrEqual(1);
    }
  });

  it('single note: Do is played first, then the note of the answer', () => {
    for (const q of many({ kind: 'note', pool: [0, 4, 7, 12], reference: true })) {
      expect(q.playback.steps[0]).toEqual([DO4]);
      expect(q.playback.steps[1]).toEqual([DO4 + Number(q.answer)]);
      expect(['0', '4', '7', '12']).toContain(q.answer);
    }
  });

  it('intervals: the two notes are the answer apart, in the asked direction', () => {
    for (const direction of ['up', 'down', 'together', 'mixed'] as const) {
      for (const q of many({ kind: 'interval', pool: [1, 3, 7, 12], direction })) {
        const steps = q.playback.steps;
        const notes = steps.flat();
        expect(Math.max(...notes) - Math.min(...notes)).toBe(Number(q.answer));
        if (q.direction === 'up') expect(steps[1][0]).toBeGreaterThan(steps[0][0]);
        if (q.direction === 'down') expect(steps[1][0]).toBeLessThan(steps[0][0]);
        if (q.direction === 'together') expect(steps).toHaveLength(1);
        if (direction !== 'mixed') expect(q.direction).toBe(direction);
      }
    }
  });

  it('chords: the notes spell the chord; arpeggios end with all notes together', () => {
    for (const style of ['block', 'arpeggio'] as const) {
      for (const q of many({ kind: 'chord', pool: ['major', 'minor', 'dim', 'dom7'], style })) {
        const shape = CHORDS[q.answer as keyof typeof CHORDS];
        expect(q.notes.map((n) => n - q.root)).toEqual([...shape]);
        expect(q.playback.steps[q.playback.steps.length - 1]).toEqual(q.notes);
        expect(q.playback.steps).toHaveLength(style === 'block' ? 1 : shape.length + 1);
      }
    }
  });

  it('every answer comes up, and the same notes are not asked twice in a row', () => {
    const qs = many({ kind: 'chord', pool: ['major', 'minor', 'aug'], style: 'block' });
    expect(new Set(qs.map((q) => q.answer))).toEqual(new Set(['major', 'minor', 'aug']));
    for (let i = 1; i < qs.length; i += 1) expect(qs[i].notes.join() === qs[i - 1].notes.join()).toBe(false);
  });

  it('every note of every lesson has a piano sample', () => {
    for (const lesson of LESSONS) {
      for (const q of many(lesson.config, 200)) {
        for (const n of allNotes(q)) {
          expect(n).toBeGreaterThanOrEqual(PIANO_LOW);
          expect(n).toBeLessThanOrEqual(PIANO_HIGH);
        }
        for (const c of q.choices) {
          const sound = soundOfChoice(lesson.config, q, c);
          for (const n of sound?.playback.steps.flat() ?? []) {
            expect(n).toBeGreaterThanOrEqual(PIANO_LOW);
            expect(n).toBeLessThanOrEqual(PIANO_HIGH);
          }
        }
      }
    }
  });

  it('hearing another choice keeps the starting note of an interval', () => {
    const config: GameConfig = { kind: 'interval', pool: [3, 4], direction: 'up' };
    const q = makeQuestion(config, lcg(9));
    const other = soundOfChoice(config, q, q.answer === '3' ? '4' : '3');
    expect(other?.playback.steps[0]).toEqual(q.playback.steps[0]);
  });
});

describe('lessons', () => {
  it('have unique ids, a name in both languages, and at least two choices', () => {
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(LESSONS.length);
    for (const l of LESSONS) {
      expect(EAR_STRINGS.tr.lessons[l.id]).toBeTruthy();
      expect(EAR_STRINGS.en.lessons[l.id]).toBeTruthy();
      expect(choicesFor(l.config).length).toBeGreaterThanOrEqual(2);
      for (const c of choicesFor(l.config)) expect(choiceLabel(l.config.kind, c, EAR_STRINGS.tr, 'tr')).toBeTruthy();
    }
    for (const u of UNITS) expect(lessonsOf(u).length).toBeGreaterThan(0);
  });

  it('open one by one within a unit', () => {
    const [first, second, third] = lessonsOf('notes');
    expect(isUnlocked(first, {})).toBe(true);
    expect(isUnlocked(second, {})).toBe(false);
    expect(isUnlocked(second, { [first.id]: 1 })).toBe(true);
    expect(isUnlocked(third, { [first.id]: 3 })).toBe(false);
    expect(nextLesson(first)).toBe(second);
    for (const u of UNITS) expect(isUnlocked(lessonsOf(u)[0], {})).toBe(true);
  });

  it('give stars for 6, 8 and 10 out of 10', () => {
    expect([5, 6, 7, 8, 9, 10].map((c) => starsFor(c, 10))).toEqual([0, 1, 1, 2, 2, 3]);
  });

  it('name notes in Turkish solfège', () => {
    expect(choiceLabel('note', '0', EAR_STRINGS.tr, 'tr')).toBe('Do');
    expect(choiceLabel('note', '7', EAR_STRINGS.tr, 'tr')).toBe('Sol');
    expect(choiceLabel('note', '12', EAR_STRINGS.tr, 'tr')).toBe('İnce Do');
    expect(choiceLabel('interval', '7', EAR_STRINGS.tr, 'tr')).toBe('Tam beşli');
  });
});
