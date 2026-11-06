import { describe, expect, it } from '@jest/globals';

import { ENSEMBLE_PRESETS, SOLO_PRESETS, songFromPreset } from '../data/presets';
import { barCapacity, barUsed, TIME_SIGNATURES, timeSigKey } from '../lib/rhythm';
import { layoutSystems, noteX } from '../lib/layout';
import {
  addBar,
  addStaff,
  barCount,
  changeSelected,
  deleteAtCursor,
  emptySong,
  fillRests,
  insertNote,
  removeBar,
  sanitizeSong,
  selectEvent,
  setTimeSig,
  startCursor,
  type Cursor,
  type EditNote,
  type Song,
} from '../lib/song';
import { buildTimeline } from '../lib/timeline';

const q: EditNote = { value: 4, rest: false, dotted: false };
const h: EditNote = { value: 2, rest: false, dotted: false };
const w: EditNote = { value: 1, rest: false, dotted: false };

function type(song: Song, notes: EditNote[]) {
  let s = song;
  let c: Cursor = startCursor(song);
  for (const n of notes) ({ song: s, cursor: c } = insertNote(s, c, n));
  return { song: s, cursor: c };
}

describe('presets', () => {
  it('fill every bar exactly', () => {
    for (const preset of [...SOLO_PRESETS, ...ENSEMBLE_PRESETS]) {
      const song = songFromPreset(preset);
      for (const staff of song.staves) {
        for (const bar of staff.bars) expect(`${preset.id}:${barUsed(bar)}`).toBe(`${preset.id}:${barCapacity(song.sig)}`);
      }
    }
  });

  it('give every staff the same number of bars', () => {
    for (const preset of ENSEMBLE_PRESETS) {
      const song = songFromPreset(preset);
      expect(new Set(song.staves.map((s) => s.bars.length)).size).toBe(1);
    }
  });
});

describe('typing notes', () => {
  it('moves to the next bar when one is full', () => {
    const { song, cursor } = type(emptySong(['clap']), [q, q, q, q, h]);
    expect(song.staves[0].bars[0]).toHaveLength(4);
    expect(song.staves[0].bars[1]).toHaveLength(1);
    expect(cursor.bar).toBe(1);
  });

  it('adds a bar when the last one is full', () => {
    const { song } = type(emptySong(['clap'], 1), [w, q]);
    expect(barCount(song)).toBe(2);
  });

  it('adds the new bar to every staff of an ensemble', () => {
    const { song } = type(emptySong(['clap', 'drum'], 1), [w, q]);
    expect(song.staves.map((s) => s.bars.length)).toEqual([2, 2]);
  });

  it('refuses a note that does not fit and says how much room is left', () => {
    const start = type(emptySong(['clap']), [q, q, q]);
    const result = insertNote(start.song, start.cursor, h);
    expect(result.song).toBe(start.song);
    expect(result.message).toEqual({ key: 'noRoom', remaining: 4 });
  });

  it('refuses a dotted sixteenth', () => {
    const song = emptySong(['clap']);
    expect(insertNote(song, startCursor(song), { value: 16, rest: false, dotted: true }).message).toEqual({ key: 'cantDot' });
  });
});

describe('changing and deleting', () => {
  it('changes a selected note when the bar still adds up', () => {
    const { song } = type(emptySong(['clap']), [q, q]);
    const id = song.staves[0].bars[0][0].id;
    const cursor = selectEvent(song, startCursor(song), song.staves[0].id, id);
    const result = changeSelected(song, cursor, { value: 2 });
    expect(result.song.staves[0].bars[0][0].value).toBe(2);
    expect(barUsed(result.song.staves[0].bars[0])).toBe(12);
  });

  it('turns a note into a rest of the same length', () => {
    const { song } = type(emptySong(['clap']), [q]);
    const id = song.staves[0].bars[0][0].id;
    const cursor = selectEvent(song, startCursor(song), song.staves[0].id, id);
    expect(changeSelected(song, cursor, { rest: true }).song.staves[0].bars[0][0].rest).toBe(true);
  });

  it('will not grow a note past the end of a full bar', () => {
    const { song } = type(emptySong(['clap']), [q, q, q, q]);
    const id = song.staves[0].bars[0][0].id;
    const cursor = selectEvent(song, startCursor(song), song.staves[0].id, id);
    expect(changeSelected(song, cursor, { value: 2 }).message?.key).toBe('noRoom');
  });

  it('deletes backwards across a bar line', () => {
    const typed = type(emptySong(['clap']), [w]);
    const atNextBar: Cursor = { ...typed.cursor, bar: 1, index: 0 };
    const result = deleteAtCursor(typed.song, atNextBar);
    expect(result.song.staves[0].bars[0]).toHaveLength(0);
    expect(result.cursor.bar).toBe(0);
  });

  it('removes a bar from every staff', () => {
    let song = emptySong(['clap', 'drum'], 3);
    song = removeBar(song, startCursor(song), 1).song;
    expect(song.staves.map((s) => s.bars.length)).toEqual([2, 2]);
  });

  it('adds a staff with as many bars as the others', () => {
    const song = addStaff(addBar(emptySong(['clap'], 2), startCursor(emptySong(['clap']))).song, 'drum');
    expect(song.staves[1].bars).toHaveLength(3);
  });
});

describe('time signatures and rests', () => {
  it('drops notes that no longer fit', () => {
    const { song, cursor } = type(emptySong(['clap']), [q, q, q, q]);
    const threeFour = TIME_SIGNATURES.find((s) => timeSigKey(s) === '3/4')!;
    const result = setTimeSig(song, cursor, threeFour);
    expect(result.song.staves[0].bars[0]).toHaveLength(3);
    expect(result.message).toEqual({ key: 'dropped', count: 1 });
  });

  it('fills unwritten space with rests', () => {
    const { song } = type(emptySong(['clap'], 2), [q]);
    const filled = fillRests(song, song.staves[0].id);
    expect(filled.staves[0].bars.map(barUsed)).toEqual([16, 16]);
  });
});

describe('timeline', () => {
  it('clicks on every beat even with no notes', () => {
    const song = emptySong(['clap'], 2);
    const tl = buildTimeline(song, { countIn: false });
    expect(tl.events.filter((e) => e.kind === 'click')).toHaveLength(8);
    expect(tl.events.filter((e) => e.kind === 'hit')).toHaveLength(0);
    expect(tl.lengthMs).toBeCloseTo((8 * 60000) / song.tempo);
  });

  it('adds a bar of count-in before the song', () => {
    const tl = buildTimeline(emptySong(['clap'], 1), { countIn: true });
    const countIn = tl.events.filter((e) => e.kind === 'click' && e.countIn);
    expect(countIn).toHaveLength(4);
    expect(countIn[0].t).toBeCloseTo(-tl.countInMs);
  });

  it('places notes by their rhythm and keeps rests silent', () => {
    const song = songFromPreset(SOLO_PRESETS.find((p) => p.id === 'rests')!);
    const tl = buildTimeline(song, { countIn: false });
    const hits = tl.events.filter((e) => e.kind === 'hit');
    const beat = 60000 / song.tempo;
    expect(hits.slice(0, 4).map((e) => Math.round(e.t))).toEqual([0, 1, 2, 3].map((i) => Math.round(i * beat)));
    expect(hits.slice(0, 4).map((e) => e.kind === 'hit' && e.sound)).toEqual(['drum', null, 'drum', null]);
  });

  it('counts 6/8 in eighth notes', () => {
    const song = songFromPreset(SOLO_PRESETS.find((p) => p.id === 'sixeight')!);
    const tl = buildTimeline(song, { countIn: false });
    expect(tl.clicksPerBar).toBe(6);
    expect(tl.barMs).toBeCloseTo((6 * 60000) / song.tempo);
  });
});

describe('layout', () => {
  it('lines up the same moment on every bar width', () => {
    const sig = TIME_SIGNATURES[2];
    const [system] = layoutSystems(4, 900, sig);
    expect(noteX(system, 1, 0, sig) - noteX(system, 0, 0, sig)).toBeCloseTo(system.barW);
  });

  it('puts more bars per row on wider screens', () => {
    const sig = TIME_SIGNATURES[2];
    expect(layoutSystems(8, 360, sig)).toHaveLength(8);
    expect(layoutSystems(8, 1100, sig).length).toBeLessThan(8);
  });
});

describe('saved songs', () => {
  it('survive a round trip through JSON', () => {
    const song = songFromPreset(ENSEMBLE_PRESETS[0]);
    const back = sanitizeSong(JSON.parse(JSON.stringify(song)))!;
    expect(back.staves.map((s) => s.bars.map(barUsed))).toEqual(song.staves.map((s) => s.bars.map(barUsed)));
    expect(back.tempo).toBe(song.tempo);
  });

  it('reject junk', () => {
    expect(sanitizeSong(null)).toBeNull();
    expect(sanitizeSong({ tempo: 90, sig: { beats: 4, unit: 4, groups: [1, 1, 1, 1] }, staves: [] })).toBeNull();
  });

  it('drop unknown notes and instruments', () => {
    const raw = {
      tempo: 9999,
      sig: { beats: 4, unit: 4, groups: [1, 1, 1, 1] },
      staves: [
        { instrument: 'kazoo', bars: [[]] },
        { instrument: 'clap', bars: [[{ value: 3 }, { value: 4 }, { value: 16, dotted: true }]] },
      ],
    };
    const song = sanitizeSong(raw)!;
    expect(song.staves).toHaveLength(1);
    expect(song.staves[0].bars[0]).toHaveLength(1);
    expect(song.tempo).toBe(260);
  });
});
