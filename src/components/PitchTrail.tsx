import { Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';

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
 * Where the lanes are centred: on the target in the matching game, else on
 * the middle of what was sung lately, moved just enough to keep the newest
 * point in view. It depends only on the trail, so the lanes move smoothly as
 * old points scroll away.
 */
function viewCenter(trail: TrailPoint[], target: number | null): number {
  const heard = trail.filter((p) => p.midi !== null).map((p) => p.midi!);
  let center = target ?? 66;
  if (target === null && heard.length) {
    const sorted = [...heard].sort((a, b) => a - b);
    center = (sorted[Math.floor(sorted.length * 0.1)] + sorted[Math.floor(sorted.length * 0.9)]) / 2;
  }
  const newest = heard[heard.length - 1];
  const reach = SPAN / 2 - 1.5;
  if (newest !== undefined) center = Math.max(newest - reach, Math.min(newest + reach, center));
  return center;
}

/**
 * The pitch of the last few seconds as a line scrolling right to left over
 * note lanes, like a singing app. The lanes follow the voice up and down, or
 * stay on the target note in the matching game. The line takes the colour
 * of the note it is nearest to.
 */
export function PitchTrail({
  trail,
  width,
  height,
  lang,
  target,
}: {
  trail: TrailPoint[];
  width: number;
  height: number;
  lang: Lang;
  target: number | null;
}) {
  const latest = trail.length ? trail[trail.length - 1] : null;
  const low = viewCenter(trail, target) - SPAN / 2;
  const laneH = height / SPAN;
  const y = (midi: number) => height - (midi - low) * laneH;
  const plotW = width - LABEL_W - NOW_PAD;
  const tNow = latest?.t ?? 0;
  const x = (t: number) => LABEL_W + plotW - ((tNow - t) / TRAIL_SECONDS) * plotW;

  const lanes: number[] = [];
  for (let m = Math.ceil(low - 0.5); m <= Math.floor(low + SPAN + 0.5); m += 1) lanes.push(m);

  // Runs of consecutive heard points with the same nearest note.
  const runs: { color: string; points: string }[] = [];
  let run: { color: string; pts: string[]; note: number } | null = null;
  for (const p of trail) {
    if (p.midi === null) {
      if (run) runs.push({ color: run.color, points: run.pts.join(' ') });
      run = null;
      continue;
    }
    const note = Math.round(p.midi);
    const pt = `${x(p.t).toFixed(1)},${y(p.midi).toFixed(1)}`;
    if (!run || run.note !== note) {
      if (run) {
        run.pts.push(pt); // join the runs so the line has no gaps
        runs.push({ color: run.color, points: run.pts.join(' ') });
      }
      run = { color: noteColor(note), pts: [pt], note };
    } else {
      run.pts.push(pt);
    }
  }
  if (run) runs.push({ color: run.color, points: run.pts.join(' ') });

  const nowMidi = latest?.midi ?? null;

  return (
    <View style={[styles.box, { width, height }]}>
      <Svg width={width} height={height}>
        {lanes.map((m) => {
          const natural = isNatural(m);
          const isTarget = target !== null && ((m - target) % 12 + 12) % 12 === 0;
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
        {runs.map((r, i) => (
          <Polyline key={i} points={r.points} fill="none" stroke={r.color} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {nowMidi !== null && (
          <Circle cx={x(tNow)} cy={y(nowMidi)} r={10} fill={noteColor(Math.round(nowMidi))} stroke="#fff" strokeWidth={3} />
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { overflow: 'hidden', borderRadius: 16, backgroundColor: colors.surface },
});
