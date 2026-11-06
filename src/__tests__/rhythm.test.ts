import { describe, expect, it } from '@jest/globals';

import {
  barCapacity,
  beamGroups,
  clickAccents,
  eventUnits,
  fitBar,
  makeEvent,
  restsFor,
  TIME_SIGNATURES,
  timeSigKey,
  type TimeSig,
} from '../lib/rhythm';
import { parsePattern } from '../data/presets';

const sig = (key: string): TimeSig => TIME_SIGNATURES.find((s) => timeSigKey(s) === key)!;
const shape = (bar: ReturnType<typeof parsePattern>[number]) =>
  bar.map((e) => `${e.rest ? '-' : ''}${{ 1: 'w', 2: 'h', 4: 'q', 8: 'e', 16: 's' }[e.value]}${e.dotted ? '.' : ''}`).join(' ');

describe('durations', () => {
  it('measures notes in sixteenths', () => {
    expect(eventUnits(makeEvent(1))).toBe(16);
    expect(eventUnits(makeEvent(4))).toBe(4);
    expect(eventUnits(makeEvent(4, { dotted: true }))).toBe(6);
    expect(eventUnits(makeEvent(8, { dotted: true }))).toBe(3);
    expect(eventUnits(makeEvent(16))).toBe(1);
  });

  it('knows how much each time signature holds', () => {
    expect(barCapacity(sig('4/4'))).toBe(16);
    expect(barCapacity(sig('3/4'))).toBe(12);
    expect(barCapacity(sig('6/8 (3+3)'))).toBe(12);
    expect(barCapacity(sig('9/8 (2+2+2+3)'))).toBe(18);
  });

  it('has groups that add up for every time signature', () => {
    for (const s of TIME_SIGNATURES) expect(s.groups.reduce((a, b) => a + b, 0)).toBe(s.beats);
  });
});

describe('metronome accents', () => {
  it('stresses the first beat of 4/4', () => {
    expect(clickAccents(sig('4/4'))).toEqual([2, 0, 0, 0]);
  });

  it('follows the aksak grouping of 9/8', () => {
    expect(clickAccents(sig('9/8 (2+2+2+3)'))).toEqual([2, 0, 1, 0, 1, 0, 1, 0, 0]);
  });

  it('marks both pulses of 6/8', () => {
    expect(clickAccents(sig('6/8 (3+3)'))).toEqual([2, 0, 0, 1, 0, 0]);
  });
});

describe('rests for a gap', () => {
  it('fills an empty 4/4 bar with a whole rest', () => {
    expect(shape(restsFor(0, 16, sig('4/4')))).toBe('-w');
  });

  it('fills the rest of a beat before using bigger rests', () => {
    // A quarter is written; then an eighth, then the gap is 10 units.
    expect(shape(restsFor(6, 10, sig('4/4')))).toBe('-e -h');
  });

  it('keeps rests inside the beat', () => {
    expect(shape(restsFor(1, 15, sig('4/4')))).toBe('-s -e -q -h');
  });

  it('writes a dotted half rest for an empty 3/4 bar', () => {
    expect(shape(restsFor(0, 12, sig('3/4')))).toBe('-h.');
  });

  it('follows the 2+2+2+3 grouping of 9/8', () => {
    expect(shape(restsFor(4, 14, sig('9/8 (2+2+2+3)')))).toBe('-q -q -q.');
  });

  it('uses dotted quarter rests for 6/8 pulses', () => {
    expect(shape(restsFor(6, 6, sig('6/8 (3+3)')))).toBe('-q.');
  });

  it('always adds up exactly', () => {
    for (const s of TIME_SIGNATURES) {
      const cap = barCapacity(s);
      for (let start = 0; start < cap; start += 1) {
        const rests = restsFor(start, cap - start, s);
        expect(rests.reduce((a, e) => a + eventUnits(e), 0)).toBe(cap - start);
        expect(rests.every((e) => e.rest)).toBe(true);
      }
    }
  });
});

describe('beams', () => {
  it('joins eighths within each beat of 4/4', () => {
    const [bar] = parsePattern('e e e e q e e');
    expect(beamGroups(bar, sig('4/4'))).toEqual([[0, 1], [2, 3], [5, 6]]);
  });

  it('joins three eighths in a 6/8 pulse', () => {
    const [bar] = parsePattern('e e e e e e');
    expect(beamGroups(bar, sig('6/8 (3+3)'))).toEqual([[0, 1, 2], [3, 4, 5]]);
  });

  it('breaks beams at rests and leaves lone eighths flagged', () => {
    const [bar] = parsePattern('e -e e e q q');
    expect(beamGroups(bar, sig('4/4'))).toEqual([[2, 3]]);
  });

  it('beams a dotted eighth with its sixteenth', () => {
    const [bar] = parsePattern('e. s e. s');
    expect(beamGroups(bar, sig('2/4'))).toEqual([[0, 1], [2, 3]]);
  });
});

describe('fitting bars to a smaller time signature', () => {
  it('drops what no longer fits', () => {
    const [bar] = parsePattern('q q q q');
    const { bar: kept, dropped } = fitBar(bar, sig('3/4'));
    expect(kept).toHaveLength(3);
    expect(dropped).toBe(1);
  });
});
