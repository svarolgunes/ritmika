/**
 * Turns a song into a flat, time-ordered list of things to play: metronome
 * clicks (always) and one hit per note or rest on every staff. Rests are
 * kept as silent hits so the editor can highlight them as they go by, and
 * unwritten space at the end of a bar simply stays silent.
 */
import type { InstrumentId } from '../data/instruments';
import { barCapacity, clickAccents, clickUnits, eventOffsets } from './rhythm';
import type { Song } from './song';

export type Click = { kind: 'click'; t: number; accent: 0 | 1 | 2; bar: number; beat: number; countIn: boolean };

export type Hit = {
  kind: 'hit';
  t: number;
  staffId: string;
  eventId: string;
  bar: number;
  /** null for a rest. */
  sound: InstrumentId | null;
};

export type TimelineEvent = Click | Hit;

export type Timeline = {
  /** Count-in clicks have negative times; the song itself starts at 0. */
  events: TimelineEvent[];
  /** Length of one pass through the song, for looping. */
  lengthMs: number;
  countInMs: number;
  barMs: number;
  clicksPerBar: number;
};

export function msPerUnit(song: Song): number {
  return 60000 / song.tempo / clickUnits(song.sig);
}

export function buildTimeline(song: Song, opts: { countIn: boolean }): Timeline {
  const unitMs = msPerUnit(song);
  const capacity = barCapacity(song.sig);
  const barMs = capacity * unitMs;
  const bars = song.staves[0]?.bars.length ?? 0;
  const accents = clickAccents(song.sig);
  const beatMs = clickUnits(song.sig) * unitMs;
  const countInMs = opts.countIn ? barMs : 0;

  const events: TimelineEvent[] = [];
  if (opts.countIn) {
    accents.forEach((accent, beat) => {
      events.push({ kind: 'click', t: -countInMs + beat * beatMs, accent, bar: -1, beat, countIn: true });
    });
  }
  for (let bar = 0; bar < bars; bar += 1) {
    accents.forEach((accent, beat) => {
      events.push({ kind: 'click', t: bar * barMs + beat * beatMs, accent, bar, beat, countIn: false });
    });
  }
  for (const staff of song.staves) {
    staff.bars.forEach((bar, b) => {
      const offsets = eventOffsets(bar);
      bar.forEach((e, i) => {
        events.push({
          kind: 'hit',
          t: b * barMs + offsets[i] * unitMs,
          staffId: staff.id,
          eventId: e.id,
          bar: b,
          sound: e.rest ? null : staff.instrument,
        });
      });
    });
  }
  // Clicks first at equal times, so the beat lands with (not after) the notes.
  events.sort((a, b) => a.t - b.t || (a.kind === b.kind ? 0 : a.kind === 'click' ? -1 : 1));
  return { events, lengthMs: bars * barMs, countInMs, barMs, clicksPerBar: accents.length };
}
