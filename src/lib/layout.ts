/**
 * Geometry of the score. Bars are laid out in rows ("systems"); in the
 * ensemble every system stacks one line per instrument so the bars line up.
 * Notes are spaced by time, so the same offset is at the same x on every staff.
 */
import type { TimeSig } from './rhythm';
import { barCapacity } from './rhythm';

export const ROW_H = 76;
/** y of the staff line inside a row. Stems go up from here. */
export const LINE_Y = 48;
export const HEADER_W = 40;
export const SIG_W = 26;
export const BAR_PAD_L = 16;
export const BAR_PAD_R = 12;
export const SYSTEM_GAP = 14;
const MIN_UNIT_W = 18;

export type SystemLayout = {
  /** Index of the first bar in this system. */
  first: number;
  count: number;
  /** Left edge of the bars area. */
  left: number;
  barW: number;
  showSig: boolean;
};

export function minBarWidth(sig: TimeSig): number {
  return Math.max(150, barCapacity(sig) * MIN_UNIT_W + BAR_PAD_L + BAR_PAD_R);
}

export function barsPerSystem(width: number, sig: TimeSig): number {
  return Math.max(1, Math.min(8, Math.floor((width - HEADER_W - SIG_W) / minBarWidth(sig))));
}

export function layoutSystems(barCount: number, width: number, sig: TimeSig): SystemLayout[] {
  const perSystem = barsPerSystem(width, sig);
  const systems: SystemLayout[] = [];
  for (let first = 0; first < Math.max(1, barCount); first += perSystem) {
    const showSig = first === 0;
    const left = HEADER_W + (showSig ? SIG_W : 0);
    systems.push({
      first,
      count: Math.min(perSystem, barCount - first),
      left,
      barW: (width - left) / perSystem,
      showSig,
    });
  }
  return systems;
}

export function barX(system: SystemLayout, barInSystem: number): number {
  return system.left + barInSystem * system.barW;
}

/** x of a notehead's left edge for an event starting `offset` units into the bar. */
export function noteX(system: SystemLayout, barInSystem: number, offset: number, sig: TimeSig): number {
  const inner = system.barW - BAR_PAD_L - BAR_PAD_R;
  return barX(system, barInSystem) + BAR_PAD_L + (offset / barCapacity(sig)) * inner;
}

export function systemHeight(staves: number): number {
  return staves * ROW_H + SYSTEM_GAP;
}
