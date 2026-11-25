import { useRef } from 'react';
import { Platform, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import type { Lang } from '../lib/i18n';
import { isNatural, noteColor, noteName, octaveOf } from '../lib/pitch/notes';
import { TRAIL_SECONDS, type TrailPoint } from '../lib/usePitch';
import { colors } from './theme';

/** Semitones shown at once: a little over an octave. */
const SPAN = 15;
const LABEL_W = 46;
const NOW_PAD = 22;
const LABEL_FONT = Platform.OS === 'web' ? 'system-ui, -apple-system, sans-serif' : undefined;

/**
 * Where the lanes are centred. In the matching game the target lane is
 * always in view, with the newest point too when both fit (e.g. an octave
 * apart). Otherwise it is the middle of what was sung lately, moved just
 * enough to keep the newest point in view. It depends only on the trail, so the lanes move smoothly as
 * old points scroll away.
 */
export function viewCenter(trail: TrailPoint[], target: number | null): number {
  // In several-note mode every line counts, the dominant one last so it stays in view.
  const heard = trail.flatMap((p) =>
    p.voices ? [...p.voices].sort((a, b) => Number(a.dominant) - Number(b.dominant)).map((v) => v.midi) : p.midi !== null ? [p.midi] : [],
  );
  let center = target ?? 66;
  if (target === null && heard.length) {
    const sorted = [...heard].sort((a, b) => a - b);
    center = (sorted[Math.floor(sorted.length * 0.1)] + sorted[Math.floor(sorted.length * 0.9)]) / 2;
  }
  const newest = heard[heard.length - 1];
  const reach = SPAN / 2 - 1.5;
  if (newest === undefined) return center;
  if (target !== null) {
    // Both in view if they fit, else the target wins and the hint says which way.
    return Math.abs(newest - target) <= 2 * reach ? (newest + target) / 2 : target;
  }
  return Math.max(newest - reach, Math.min(newest + reach, center));
}

/** The lowest and highest centre the lanes can be dragged to (about Do1 … Do7). */
export const MIN_CENTER = 30;
export const MAX_CENTER = 96;

/** A smooth curve through the points: quadratic segments between midpoints. */
function smoothPath(pts: [number, number][]): string {
  if (pts.length === 1) return `M ${pts[0][0]} ${pts[0][1]} l 0.1 0`;
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i += 1) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    d += ` Q ${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
  }
  const last = pts[pts.length - 1];
  return `${d} L ${last[0].toFixed(1)} ${last[1].toFixed(1)}`;
}

/** A line that moves more than this between two moments (semitones) is cut, not joined. */
const BREAK = 1;
/** Opacity of the non-dominant lines in several-note mode. */
const SOFT_ALPHA = 0.35;

type SeriesPoint = { t: number; midi: number | null; alpha: number };

/**
 * Cuts one line's points into drawable pieces. A piece ends at silence, at
 * a time gap, or at a jump bigger than BREAK (so a leap starts a fresh line
 * instead of drawing a stroke across the notes in between). Within a line,
 * a new piece starts when the nearest note or the opacity changes, joined
 * at the same point so it looks continuous.
 */
function buildSegments(pts: SeriesPoint[], x: (t: number) => number, y: (m: number) => number) {
  const out: { color: string; alpha: number; d: string }[] = [];
  let run: { color: string; alpha: number; pts: [number, number][]; note: number } | null = null;
  let prev: SeriesPoint | null = null;
  const close = () => {
    if (run) out.push({ color: run.color, alpha: run.alpha, d: smoothPath(run.pts) });
    run = null;
  };
  for (const p of pts) {
    if (p.midi === null) {
      close();
      prev = null;
      continue;
    }
    if (prev && prev.midi !== null && (Math.abs(p.midi - prev.midi) > BREAK || p.t - prev.t > 0.12)) close();
    const note = Math.round(p.midi);
    const pt: [number, number] = [x(p.t), y(p.midi)];
    const current = run as { color: string; alpha: number; pts: [number, number][]; note: number } | null;
    if (!current) {
      run = { color: noteColor(note), alpha: p.alpha, pts: [pt], note };
    } else if (current.note !== note || current.alpha !== p.alpha) {
      current.pts.push(pt);
      close();
      run = { color: noteColor(note), alpha: p.alpha, pts: [current.pts[current.pts.length - 2] ?? pt, pt], note };
    } else {
      current.pts.push(pt);
    }
    prev = p;
  }
  close();
  return out;
}

/**
 * The pitch of the last few seconds as a line scrolling right to left over
 * note lanes, like a singing app. The line takes the colour of the note it
 * is nearest to.
 *
 * With `center` null the lanes follow the voice up and down (or stay on the
 * target in the matching game). With a number they stay put, and dragging
 * up or down moves smoothly through the notes and octaves via onDrag.
 */
export function PitchTrail({
  trail,
  width,
  height,
  lang,
  target,
  center,
  onDrag,
  onDragActive,
}: {
  trail: TrailPoint[];
  width: number;
  height: number;
  lang: Lang;
  target: number | null;
  center: number | null;
  onDrag?: (center: number) => void;
  /** True while a drag is going on, so a parent ScrollView can stand still. */
  onDragActive?: (active: boolean) => void;
}) {
  const laneH = height / SPAN;
  const dragging = center !== null && !!onDrag;
  /** Where a drag started: finger position and lane centre. */
  const dragStart = useRef({ y: 0, center: 0 });

  // Plain responder props rather than PanResponder: only active when not following.
  const drag = dragging
    ? {
        onStartShouldSetResponderCapture: () => true,
        onMoveShouldSetResponderCapture: () => true,
        onResponderTerminationRequest: () => false,
        onResponderGrant: (e: GestureResponderEvent) => {
          dragStart.current = { y: e.nativeEvent.pageY, center: center ?? 0 };
          onDragActive?.(true);
        },
        onResponderMove: (e: GestureResponderEvent) => {
          // Pulling the lanes down brings higher notes into view, like scrolling a page.
          const dy = e.nativeEvent.pageY - dragStart.current.y;
          onDrag?.(Math.max(MIN_CENTER, Math.min(MAX_CENTER, dragStart.current.center + dy / laneH)));
        },
        onResponderRelease: () => onDragActive?.(false),
        onResponderTerminate: () => onDragActive?.(false),
      }
    : {};

  const latest = trail.length ? trail[trail.length - 1] : null;
  const low = (center ?? viewCenter(trail, target)) - SPAN / 2;
  const y = (midi: number) => height - (midi - low) * laneH;
  const plotW = width - LABEL_W - NOW_PAD;
  const tNow = latest?.t ?? 0;
  const x = (t: number) => LABEL_W + plotW - ((tNow - t) / TRAIL_SECONDS) * plotW;

  const lanes: number[] = [];
  for (let m = Math.ceil(low - 0.5); m <= Math.floor(low + SPAN + 0.5); m += 1) lanes.push(m);

  // One series per line: the single pitch line, or one per voice in several-note mode.
  const poly = trail.some((p) => p.voices !== undefined);
  const series = new Map<number, SeriesPoint[]>();
  if (poly) {
    for (const p of trail) {
      for (const v of p.voices ?? []) {
        const list = series.get(v.id) ?? [];
        list.push({ t: p.t, midi: v.midi, alpha: v.dominant ? 1 : SOFT_ALPHA });
        series.set(v.id, list);
      }
    }
  } else {
    series.set(0, trail.map((p) => ({ t: p.t, midi: p.midi, alpha: 1 })));
  }
  const segments = [...series.values()].flatMap((pts) => buildSegments(pts, x, y));
  // The dominant (opaque) line on top of the others.
  segments.sort((a, b) => a.alpha - b.alpha);
  const dots = poly
    ? (latest?.voices ?? []).map((v) => ({ midi: v.midi, alpha: v.dominant ? 1 : SOFT_ALPHA }))
    : latest?.midi != null
      ? [{ midi: latest.midi, alpha: 1 }]
      : [];
  dots.sort((a, b) => a.alpha - b.alpha);


  return (
    <View style={[styles.box, { width, height }, dragging && styles.draggable]} {...drag}>
      <Svg width={width} height={height}>
        {lanes.map((m) => {
          const natural = isNatural(m);
          const isTarget = target === m;
          const top = y(m + 0.5);
          return (
            <G key={m}>
              {isTarget ? (
                <Rect x={LABEL_W} y={top} width={plotW + NOW_PAD} height={laneH} fill={noteColor(m)} opacity={0.28} />
              ) : natural ? (
                <Rect x={LABEL_W} y={top} width={plotW + NOW_PAD} height={laneH} fill={noteColor(m)} opacity={0.08} />
              ) : null}
              <Line x1={LABEL_W} x2={width} y1={top} y2={top} stroke={colors.border} strokeWidth={1} />
              {natural && laneH > 9 && y(m) > 9 && y(m) < height - 6 && (
                <SvgText
                  x={LABEL_W - 6}
                  y={y(m) + Math.min(laneH, 16) * 0.35}
                  fontSize={Math.min(14, laneH * 0.9)}
                  fontWeight="800"
                  fontFamily={LABEL_FONT}
                  fill={noteColor(m)}
                  textAnchor="end"
                >
                  {`${noteName(m, lang)}${octaveOf(m)}`}
                </SvgText>
              )}
            </G>
          );
        })}
        {segments.map((r, i) => (
          <Path key={i} d={r.d} fill="none" stroke={r.color} strokeOpacity={r.alpha} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {dots.map((d, i) => (
          <Circle key={i} cx={x(tNow)} cy={y(d.midi)} r={d.alpha === 1 ? 10 : 7} fill={noteColor(Math.round(d.midi))} fillOpacity={d.alpha} stroke="#fff" strokeOpacity={d.alpha} strokeWidth={3} />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { overflow: 'hidden', borderRadius: 16, backgroundColor: colors.surface },
  draggable: Platform.select({ web: { cursor: 'grab', touchAction: 'none', userSelect: 'none' } as object, default: {} }),
});
