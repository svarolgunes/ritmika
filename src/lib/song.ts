/**
 * Songs and the editing operations on them. Everything here is pure: each
 * operation takes a song and a cursor and returns new ones, which keeps the
 * editor easy to test and lets React compare bars by reference.
 */
import { instrument, isInstrumentId, type InstrumentId } from '../data/instruments';
import {
  barCapacity,
  barRemaining,
  canDot,
  DEFAULT_SIG,
  fitBar,
  makeEvent,
  newId,
  NOTE_VALUES,
  restsFor,
  TIME_SIGNATURES,
  timeSigKey,
  valueUnits,
  type Bar,
  type NoteEvent,
  type NoteValue,
  type TimeSig,
} from './rhythm';

export type Staff = {
  id: string;
  instrument: InstrumentId;
  muted: boolean;
  bars: Bar[];
};

export type Song = {
  tempo: number;
  sig: TimeSig;
  /** Every staff has the same number of bars. */
  staves: Staff[];
};

/** Where the next note goes, and which note (if any) is selected for changing. */
export type Cursor = {
  staffId: string;
  bar: number;
  index: number;
  selectedId: string | null;
};

export type EditNote = { value: NoteValue; rest: boolean; dotted: boolean };

/** Messages the editor shows; translated in the UI. */
export type EditMessage = { key: 'noRoom'; remaining: number } | { key: 'dropped'; count: number } | { key: 'cantDot' };

export type EditResult = { song: Song; cursor: Cursor; message?: EditMessage };

export const MIN_TEMPO = 30;
export const MAX_TEMPO = 260;
export const MAX_STAVES = 8;
export const MAX_BARS = 64;

export const clampTempo = (t: number) => Math.round(Math.min(MAX_TEMPO, Math.max(MIN_TEMPO, t)));

export function emptyStaff(id: InstrumentId, barCount: number): Staff {
  return { id: newId(), instrument: id, muted: false, bars: Array.from({ length: barCount }, () => []) };
}

export function emptySong(instruments: InstrumentId[], barCount = 2, sig: TimeSig = DEFAULT_SIG, tempo = 90): Song {
  return { tempo, sig, staves: instruments.map((i) => emptyStaff(i, barCount)) };
}

export function barCount(song: Song): number {
  return song.staves[0]?.bars.length ?? 0;
}

export function startCursor(song: Song): Cursor {
  return { staffId: song.staves[0]?.id ?? '', bar: 0, index: 0, selectedId: null };
}

function findEvent(staff: Staff, id: string): { bar: number; index: number } | null {
  for (let b = 0; b < staff.bars.length; b += 1) {
    const i = staff.bars[b].findIndex((e) => e.id === id);
    if (i >= 0) return { bar: b, index: i };
  }
  return null;
}

function replaceStaff(song: Song, staff: Staff): Song {
  return { ...song, staves: song.staves.map((s) => (s.id === staff.id ? staff : s)) };
}

function replaceBar(staff: Staff, barIndex: number, bar: Bar): Staff {
  return { ...staff, bars: staff.bars.map((b, i) => (i === barIndex ? bar : b)) };
}

function appendBars(song: Song, count: number): Song {
  return {
    ...song,
    staves: song.staves.map((s) => ({ ...s, bars: [...s.bars, ...Array.from({ length: count }, () => [] as Bar)] })),
  };
}

/** Keeps a cursor pointing at something that exists. */
export function normalizeCursor(song: Song, cursor: Cursor): Cursor {
  const staff = song.staves.find((s) => s.id === cursor.staffId) ?? song.staves[0];
  if (!staff) return cursor;
  const bar = Math.max(0, Math.min(cursor.bar, staff.bars.length - 1));
  const index = Math.max(0, Math.min(cursor.index, staff.bars[bar].length));
  const selectedId = cursor.selectedId && findEvent(staff, cursor.selectedId) ? cursor.selectedId : null;
  return { staffId: staff.id, bar, index, selectedId };
}

/** Puts a note or rest at the cursor; moves on to the next bar when the current one is full. */
export function insertNote(song: Song, cursor: Cursor, note: EditNote): EditResult {
  const c = normalizeCursor(song, cursor);
  let s = song;
  let staff = s.staves.find((x) => x.id === c.staffId);
  if (!staff) return { song, cursor: c };
  if (note.dotted && !canDot(note.value)) return { song, cursor: c, message: { key: 'cantDot' } };
  const units = valueUnits(note.value, note.dotted);
  let bar = c.bar;
  let index = c.index;

  if (barRemaining(staff.bars[bar], s.sig) === 0) {
    if (bar + 1 >= staff.bars.length) {
      if (staff.bars.length >= MAX_BARS) return { song, cursor: c, message: { key: 'noRoom', remaining: 0 } };
      s = appendBars(s, 1);
      staff = s.staves.find((x) => x.id === c.staffId)!;
    }
    bar += 1;
    index = 0;
  }

  const remaining = barRemaining(staff.bars[bar], s.sig);
  if (units > remaining) {
    return { song, cursor: { ...c, selectedId: null }, message: { key: 'noRoom', remaining } };
  }
  const event = makeEvent(note.value, { rest: note.rest, dotted: note.dotted });
  const nextBar = [...staff.bars[bar]];
  nextBar.splice(index, 0, event);
  s = replaceStaff(s, replaceBar(staff, bar, nextBar));
  return { song: s, cursor: { staffId: staff.id, bar, index: index + 1, selectedId: null } };
}

/** Changes the selected event's value, dot or kind, if the bar still adds up. */
export function changeSelected(song: Song, cursor: Cursor, patch: Partial<EditNote>): EditResult {
  const c = normalizeCursor(song, cursor);
  const staff = song.staves.find((x) => x.id === c.staffId);
  if (!staff || !c.selectedId) return { song, cursor: c };
  const at = findEvent(staff, c.selectedId);
  if (!at) return { song, cursor: c };
  const old = staff.bars[at.bar][at.index];
  const next: NoteEvent = { ...old, ...patch };
  if (patch.value !== undefined && patch.dotted === undefined && !canDot(next.value)) next.dotted = false;
  if (next.dotted && !canDot(next.value)) return { song, cursor: c, message: { key: 'cantDot' } };
  const delta = valueUnits(next.value, next.dotted) - valueUnits(old.value, old.dotted);
  const remaining = barRemaining(staff.bars[at.bar], song.sig);
  if (delta > remaining) {
    return { song, cursor: c, message: { key: 'noRoom', remaining: remaining + valueUnits(old.value, old.dotted) } };
  }
  const bar = staff.bars[at.bar].map((e) => (e.id === old.id ? next : e));
  return { song: replaceStaff(song, replaceBar(staff, at.bar, bar)), cursor: c };
}

/** Deletes the selected event, or the one just before the cursor (like backspace). */
export function deleteAtCursor(song: Song, cursor: Cursor): EditResult {
  const c = normalizeCursor(song, cursor);
  const staff = song.staves.find((x) => x.id === c.staffId);
  if (!staff) return { song, cursor: c };
  let target: { bar: number; index: number } | null = null;
  if (c.selectedId) target = findEvent(staff, c.selectedId);
  else if (c.index > 0) target = { bar: c.bar, index: c.index - 1 };
  else if (c.bar > 0 && staff.bars[c.bar - 1].length > 0) target = { bar: c.bar - 1, index: staff.bars[c.bar - 1].length - 1 };
  if (!target) return { song, cursor: c };
  const bar = staff.bars[target.bar].filter((_, i) => i !== target!.index);
  return {
    song: replaceStaff(song, replaceBar(staff, target.bar, bar)),
    cursor: { staffId: staff.id, bar: target.bar, index: target.index, selectedId: null },
  };
}

/** Taps on a note: selects it, or unselects it when tapped again. */
export function selectEvent(song: Song, cursor: Cursor, staffId: string, eventId: string): Cursor {
  const staff = song.staves.find((x) => x.id === staffId);
  const at = staff && findEvent(staff, eventId);
  if (!staff || !at) return cursor;
  if (cursor.selectedId === eventId) return { staffId, bar: at.bar, index: at.index + 1, selectedId: null };
  return { staffId, bar: at.bar, index: at.index + 1, selectedId: eventId };
}

/** Taps on the empty part of a bar: the cursor goes to its end. */
export function cursorToBarEnd(song: Song, staffId: string, bar: number): Cursor {
  const staff = song.staves.find((x) => x.id === staffId) ?? song.staves[0];
  return normalizeCursor(song, { staffId: staff.id, bar, index: staff.bars[bar]?.length ?? 0, selectedId: null });
}

export function addBar(song: Song, cursor: Cursor): EditResult {
  if (barCount(song) >= MAX_BARS) return { song, cursor };
  const s = appendBars(song, 1);
  const last = barCount(s) - 1;
  return { song: s, cursor: { ...cursor, bar: last, index: 0, selectedId: null } };
}

export function removeBar(song: Song, cursor: Cursor, barIndex: number): EditResult {
  if (barCount(song) <= 1) {
    const cleared = { ...song, staves: song.staves.map((st) => ({ ...st, bars: [[] as Bar] })) };
    return { song: cleared, cursor: normalizeCursor(cleared, { ...cursor, bar: 0, index: 0, selectedId: null }) };
  }
  const s = { ...song, staves: song.staves.map((st) => ({ ...st, bars: st.bars.filter((_, i) => i !== barIndex) })) };
  return { song: s, cursor: normalizeCursor(s, { ...cursor, bar: Math.min(barIndex, barCount(s) - 1), index: 0, selectedId: null }) };
}

/** Fills the unwritten end of every bar of a staff with rests. */
export function fillRests(song: Song, staffId: string): Song {
  const staff = song.staves.find((x) => x.id === staffId);
  if (!staff) return song;
  const capacity = barCapacity(song.sig);
  const bars = staff.bars.map((bar) => {
    const remaining = barRemaining(bar, song.sig);
    if (remaining <= 0) return bar;
    return [...bar, ...restsFor(capacity - remaining, remaining, song.sig)];
  });
  return replaceStaff(song, { ...staff, bars });
}

export function setTimeSig(song: Song, cursor: Cursor, sig: TimeSig): EditResult {
  let dropped = 0;
  const staves = song.staves.map((st) => ({
    ...st,
    bars: st.bars.map((bar) => {
      const fit = fitBar(bar, sig);
      dropped += fit.dropped;
      return fit.dropped ? fit.bar : bar;
    }),
  }));
  const s = { ...song, sig, staves };
  return { song: s, cursor: normalizeCursor(s, { ...cursor, selectedId: null }), message: dropped ? { key: 'dropped', count: dropped } : undefined };
}

export function setTempo(song: Song, tempo: number): Song {
  return { ...song, tempo: clampTempo(tempo) };
}

export function addStaff(song: Song, id: InstrumentId): Song {
  if (song.staves.length >= MAX_STAVES) return song;
  return { ...song, staves: [...song.staves, emptyStaff(id, Math.max(1, barCount(song)))] };
}

export function removeStaff(song: Song, staffId: string): Song {
  if (song.staves.length <= 1) return song;
  return { ...song, staves: song.staves.filter((s) => s.id !== staffId) };
}

export function setInstrument(song: Song, staffId: string, id: InstrumentId): Song {
  return { ...song, staves: song.staves.map((s) => (s.id === staffId ? { ...s, instrument: id } : s)) };
}

export function toggleMute(song: Song, staffId: string): Song {
  return { ...song, staves: song.staves.map((s) => (s.id === staffId ? { ...s, muted: !s.muted } : s)) };
}

export function clearSong(song: Song): Song {
  return { ...song, staves: song.staves.map((s) => ({ ...s, bars: [[], []] })) };
}

// ---------------------------------------------------------------------------
// Saving and loading

const sigByKey = new Map(TIME_SIGNATURES.map((s) => [timeSigKey(s), s]));

/** Rebuilds a song from stored JSON, dropping anything that doesn't make sense. */
export function sanitizeSong(raw: unknown): Song | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const sigRaw = r.sig as TimeSig | undefined;
  const sig = sigRaw && Array.isArray(sigRaw.groups) ? sigByKey.get(timeSigKey(sigRaw)) : undefined;
  if (!sig || !Array.isArray(r.staves) || r.staves.length === 0) return null;
  const tempo = typeof r.tempo === 'number' && Number.isFinite(r.tempo) ? clampTempo(r.tempo) : 90;

  const staves: Staff[] = [];
  for (const st of r.staves.slice(0, MAX_STAVES)) {
    if (!st || typeof st !== 'object' || !isInstrumentId(st.instrument) || !Array.isArray(st.bars)) continue;
    const bars: Bar[] = st.bars.slice(0, MAX_BARS).map((bar: unknown) => {
      if (!Array.isArray(bar)) return [];
      const events: Bar = bar
        .filter(
          (e): e is NoteEvent =>
            !!e &&
            typeof e === 'object' &&
            NOTE_VALUES.includes((e as NoteEvent).value) &&
            (!(e as NoteEvent).dotted || canDot((e as NoteEvent).value)),
        )
        .map((e) => ({ id: newId(), value: e.value, rest: !!e.rest, dotted: !!e.dotted }));
      return fitBar(events, sig).bar;
    });
    staves.push({ id: newId(), instrument: instrument(st.instrument).id, muted: !!st.muted, bars });
  }
  if (staves.length === 0) return null;
  const length = Math.max(1, ...staves.map((s) => s.bars.length));
  for (const s of staves) while (s.bars.length < length) s.bars.push([]);
  return { tempo, sig, staves };
}
