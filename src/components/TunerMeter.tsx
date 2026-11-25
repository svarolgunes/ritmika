import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path } from 'react-native-svg';

import { colors } from './theme';

const W = 220;
const H = 124;
const CX = W / 2;
const CY = H - 14;
const R = 92;
/** The needle swings ±SWING degrees for ±50 cents. */
const SWING = 70;
const IN_TUNE = 10;

function polar(deg: number, r: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
}

function arc(fromDeg: number, toDeg: number, r: number) {
  const a = polar(fromDeg, r);
  const b = polar(toDeg, r);
  return `M ${a.x} ${a.y} A ${r} ${r} 0 0 1 ${b.x} ${b.y}`;
}

/**
 * A tuner needle: how far the sound is from the nearest note, flat on the
 * left and sharp on the right, with a green middle where it's in tune.
 */
export function TunerMeter({ cents, color, lowLabel, highLabel }: { cents: number | null; color: string; lowLabel: string; highLabel: string }) {
  const c = cents === null ? 0 : Math.max(-50, Math.min(50, cents));
  const angle = (c / 50) * SWING;
  const tip = polar(angle, R - 10);
  const inTune = cents !== null && Math.abs(cents) <= IN_TUNE;
  const ticks = [-50, -40, -30, -20, -10, 0, 10, 20, 30, 40, 50];

  return (
    <View style={styles.wrap} accessibilityRole="none">
      <Svg width={W} height={H}>
        <Path d={arc(-SWING, SWING, R)} stroke={colors.border} strokeWidth={14} fill="none" strokeLinecap="round" />
        <Path
          d={arc((-IN_TUNE / 50) * SWING, (IN_TUNE / 50) * SWING, R)}
          stroke={colors.success}
          strokeWidth={14}
          fill="none"
          opacity={inTune ? 1 : 0.45}
        />
        {ticks.map((t) => {
          const a = polar((t / 50) * SWING, R - 12);
          const b = polar((t / 50) * SWING, R - (t === 0 ? 26 : 19));
          return <Line key={t} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={colors.staff} strokeWidth={t === 0 ? 3 : 2} />;
        })}
        {cents !== null && (
          <G>
            <Line x1={CX} y1={CY} x2={tip.x} y2={tip.y} stroke={inTune ? colors.success : color} strokeWidth={5} strokeLinecap="round" />
            <Circle cx={CX} cy={CY} r={8} fill={inTune ? colors.success : color} />
          </G>
        )}
        {cents === null && <Circle cx={CX} cy={CY} r={8} fill={colors.locked} />}
      </Svg>
      <View style={styles.labels}>
        <Text style={styles.label}>♭ {lowLabel}</Text>
        <Text style={styles.label}>{highLabel} ♯</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: W, alignItems: 'center' },
  labels: { width: W, flexDirection: 'row', justifyContent: 'space-between', marginTop: -6, paddingHorizontal: 4 },
  label: { fontSize: 13, fontWeight: '800', color: colors.muted },
});
