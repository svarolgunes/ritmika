/**
 * The rhythm model. Every duration is measured in sixteenth notes ("units"),
 * so a quarter note is 4 units and a 4/4 bar holds 16.
 */

/** 1 = whole, 2 = half, 4 = quarter, 8 = eighth, 16 = sixteenth. */
export type NoteValue = 1 | 2 | 4 | 8 | 16;

export const NOTE_VALUES: NoteValue[] = [1, 2, 4, 8, 16];

export type NoteEvent = {
  id: string;
  rest: boolean;
  value: NoteValue;
  dotted: boolean;
};

export type Bar = NoteEvent[];

export type TimeSig = {
  beats: number;
  unit: 2 | 4 | 8;
  /** How the beats group into pulses, e.g. 9/8 as 2+2+2+3. Sums to `beats`. */
  groups: number[];
};

let counter = 0;
export function newId(): string {
  counter += 1;
  return `${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function makeEvent(value: NoteValue, opts: { rest?: boolean; dotted?: boolean } = {}): NoteEvent {
  return { id: newId(), value, rest: opts.rest ?? false, dotted: opts.dotted ?? false };
}

export function valueUnits(value: NoteValue, dotted: boolean): number {
  const base = 16 / value;
  return dotted ? base * 1.5 : base;
}

export function eventUnits(e: Pick<NoteEvent, 'value' | 'dotted'>): number {
  return valueUnits(e.value, e.dotted);
}

/** A dotted sixteenth would need thirty-second notes to complete, so it is not offered. */
export function canDot(value: NoteValue): boolean {
  return value !== 16;
}

export function barCapacity(sig: TimeSig): number {
  return (sig.beats * 16) / sig.unit;
}

export function barUsed(bar: Bar): number {
  return bar.reduce((sum, e) => sum + eventUnits(e), 0);
}

export function barRemaining(bar: Bar, sig: TimeSig): number {
  return barCapacity(sig) - barUsed(bar);
}

/** Offsets (in units) where each event starts within its bar. */
export function eventOffsets(bar: Bar): number[] {
  const out: number[] = [];
  let at = 0;
  for (const e of bar) {
    out.push(at);
    at += eventUnits(e);
  }
  return out;
}

/** Units per click of the metronome, i.e. one beat of the time signature's unit. */
export function clickUnits(sig: TimeSig): number {
  return 16 / sig.unit;
}

/** Start offsets (in units) of each pulse group, used for accents and beaming. */
export function groupStarts(sig: TimeSig): number[] {
  const starts: number[] = [];
  let at = 0;
  for (const g of sig.groups) {
    starts.push(at);
    at += g * clickUnits(sig);
  }
  return starts;
}

/** 2 = first beat of the bar, 1 = start of a pulse group, 0 = any other beat. */
export function clickAccents(sig: TimeSig): (0 | 1 | 2)[] {
  const out: (0 | 1 | 2)[] = [];
  // In 2/4, 3/4… each beat is its own group; only the downbeat is stressed.
  const simple = sig.groups.every((g) => g === 1);
  sig.groups.forEach((g, gi) => {
    for (let i = 0; i < g; i += 1) out.push(i === 0 && gi === 0 ? 2 : i === 0 && !simple ? 1 : 0);
  });
  return out;
}

export function timeSigKey(sig: TimeSig): string {
  const simple = sig.groups.every((g) => g === 1);
  return simple ? `${sig.beats}/${sig.unit}` : `${sig.beats}/${sig.unit} (${sig.groups.join('+')})`;
}

const sig = (beats: number, unit: 2 | 4 | 8, groups?: number[]): TimeSig => ({
  beats,
  unit,
  groups: groups ?? Array.from({ length: beats }, () => 1),
});

/** Time signatures offered in the picker, including the Turkish aksak meters. */
export const TIME_SIGNATURES: TimeSig[] = [
  sig(2, 4),
  sig(3, 4),
  sig(4, 4),
  sig(5, 4),
  sig(3, 8, [3]),
  sig(5, 8, [2, 3]),
  sig(6, 8, [3, 3]),
  sig(7, 8, [2, 2, 3]),
  sig(9, 8, [3, 3, 3]),
  sig(9, 8, [2, 2, 2, 3]),
  sig(12, 8, [3, 3, 3, 3]),
];

export const DEFAULT_SIG = TIME_SIGNATURES[2];

/**
 * Splits a gap into rests that line up with the beat, largest first, so
 * "fill with rests" gives readable notation (no rest crossing a beat group
 * unless it fills whole groups).
 */
export function restsFor(start: number, length: number, s: TimeSig): NoteEvent[] {
  const capacity = barCapacity(s);
  const boundaries = [...groupStarts(s), capacity];
  const candidates: { value: NoteValue; dotted: boolean; units: number }[] = [];
  for (const value of NOTE_VALUES) {
    candidates.push({ value, dotted: false, units: valueUnits(value, false) });
    if (canDot(value)) candidates.push({ value, dotted: true, units: valueUnits(value, true) });
  }
  candidates.sort((a, b) => b.units - a.units);

  const out: NoteEvent[] = [];
  const end = start + length;
  let at = start;
  while (at < end) {
    const groupIndex = boundaries.findIndex((b, i) => b <= at && at < boundaries[i + 1]);
    const groupStart = boundaries[groupIndex];
    const groupEnd = boundaries[groupIndex + 1];
    const pick = candidates.find(({ dotted, units }) => {
      if (at + units > end) return false;
      // Whole beat groups can be covered by one rest (a half rest on beats
      // 1–2 or 3–4, a dotted quarter filling a 6/8 pulse), as long as it
      // starts on its own grid: no half rest starting on beat 2.
      if (at === groupStart && boundaries.includes(at + units)) {
        if (at % units === 0 || (dotted && units === groupEnd - groupStart)) return true;
      }
      // Otherwise stay inside the beat and land on the rest's own grid.
      return !dotted && at + units <= groupEnd && (at - groupStart) % units === 0;
    })!; // a sixteenth always fits
    out.push(makeEvent(pick.value, { rest: true, dotted: pick.dotted }));
    at += pick.units;
  }
  return out;
}

/**
 * Groups of note indices that should be joined by a beam: consecutive
 * flagged notes (eighths and shorter) inside the same beat group.
 */
export function beamGroups(bar: Bar, s: TimeSig): number[][] {
  const groups: number[][] = [];
  const capacity = barCapacity(s);
  // Beam per quarter-note beat in x/4, per pulse group (e.g. 3 eighths) in x/8.
  const boundaries = [...groupStarts(s), capacity];
  const groupOf = (offset: number) => {
    for (let i = boundaries.length - 2; i >= 0; i -= 1) if (offset >= boundaries[i]) return i;
    return 0;
  };
  const offsets = eventOffsets(bar);
  let current: number[] = [];
  let currentGroup = -1;
  const flush = () => {
    if (current.length >= 2) groups.push(current);
    current = [];
  };
  bar.forEach((e, i) => {
    const flagged = !e.rest && e.value >= 8;
    const g = groupOf(offsets[i]);
    const endsInGroup = offsets[i] + eventUnits(e) <= (boundaries[g + 1] ?? capacity);
    if (!flagged || !endsInGroup) {
      flush();
      currentGroup = -1;
      return;
    }
    if (g !== currentGroup) {
      flush();
      currentGroup = g;
    }
    current.push(i);
  });
  flush();
  return groups;
}

/**
 * Keeps the events that still fit when the time signature shrinks.
 * Returns the new bar and how many events had to be dropped.
 */
export function fitBar(bar: Bar, s: TimeSig): { bar: Bar; dropped: number } {
  const capacity = barCapacity(s);
  const kept: Bar = [];
  let used = 0;
  for (const e of bar) {
    const u = eventUnits(e);
    if (used + u > capacity) break;
    kept.push(e);
    used += u;
  }
  return { bar: kept, dropped: bar.length - kept.length };
}
