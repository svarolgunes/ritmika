import { memo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';

import { instrument } from '../data/instruments';
import { BAR_PAD_R, barX, HEADER_W, layoutSystems, LINE_Y, noteX, ROW_H, SIG_W, SYSTEM_GAP, type SystemLayout } from '../lib/layout';
import { barCapacity, barUsed, beamGroups, eventOffsets, eventUnits, type Bar, type TimeSig } from '../lib/rhythm';
import type { Cursor, Song, Staff } from '../lib/song';
import { BEAM_GAP, BEAM_W, HEAD_RX, NoteGlyph, PercussionClef, RestGlyph, STEM, stemX } from './glyphs';
import { colors } from './theme';

type Props = {
  song: Song;
  cursor: Cursor | null;
  /** The event sounding on each staff, by staff id. */
  active: Record<string, string>;
  width: number;
  /** Show which staff the palette writes to (only matters with several). */
  highlightStaff: boolean;
  onTapEvent: (staffId: string, eventId: string) => void;
  onTapBar: (staffId: string, bar: number) => void;
  onTapLabel?: (staffId: string) => void;
  /** Play mode: no cursor, no dashed gaps and nothing to tap. */
  readOnly?: boolean;
};

const headCx = (system: SystemLayout, b: number, offset: number, sig: TimeSig) => noteX(system, b, offset, sig) + HEAD_RX + 2;

function colorFor(staff: Staff, eventId: string, cursor: Cursor | null, active: Record<string, string>) {
  if (active[staff.id] === eventId) return colors.success;
  if (cursor?.selectedId === eventId) return colors.accent;
  return staff.muted ? colors.muted : colors.ink;
}

function BarContents(props: {
  staff: Staff;
  bar: Bar;
  barIndex: number;
  b: number;
  system: SystemLayout;
  sig: TimeSig;
  y: number;
  cursor: Cursor | null;
  active: Record<string, string>;
  showGaps: boolean;
}) {
  const { staff, bar, barIndex, b, system, sig, y, cursor, active, showGaps } = props;
  const capacity = barCapacity(sig);
  const offsets = eventOffsets(bar);
  const used = barUsed(bar);
  const left = barX(system, b);
  const right = left + system.barW;
  const xs = offsets.map((o) => headCx(system, b, o, sig));
  const beams = beamGroups(bar, sig);
  const beamed = new Map<number, number>();
  beams.forEach((g, gi) => g.forEach((i) => beamed.set(i, gi)));
  const stemTop = y - STEM;
  const wholeBarRest = bar.length === 1 && bar[0].rest && eventUnits(bar[0]) === capacity;

  const parts: ReactNode[] = [];

  if (showGaps && used < capacity) {
    const gapLeft = used === 0 ? left + 8 : noteX(system, b, used, sig) + 2;
    parts.push(
      <Rect
        key="gap"
        x={gapLeft}
        y={y - 12}
        width={Math.max(6, right - BAR_PAD_R / 2 - gapLeft)}
        height={24}
        rx={7}
        fill="none"
        stroke={colors.staff}
        strokeDasharray="4 4"
        strokeWidth={1.4}
      />,
    );
  }

  bar.forEach((e, i) => {
    const color = colorFor(staff, e.id, cursor, active);
    if (e.rest) {
      const cx = wholeBarRest ? left + system.barW / 2 : xs[i];
      parts.push(<RestGlyph key={e.id} cx={cx} y={y} value={wholeBarRest ? 1 : e.value} dotted={wholeBarRest ? false : e.dotted} color={color} />);
    } else {
      parts.push(
        <NoteGlyph key={e.id} cx={xs[i]} y={y} value={e.value} dotted={e.dotted} color={color} stemTop={beamed.has(i) ? stemTop : undefined} />,
      );
    }
  });

  const beamColor = staff.muted ? colors.muted : colors.ink;
  beams.forEach((group, gi) => {
    const x1 = stemX(xs[group[0]]) - 0.8;
    const x2 = stemX(xs[group[group.length - 1]]) + 0.8;
    parts.push(<Rect key={`beam${gi}`} x={x1} y={stemTop} width={x2 - x1} height={BEAM_W} fill={beamColor} />);
    // Second beam for sixteenths: joined where neighbours are both sixteenths, a stub otherwise.
    group.forEach((i, k) => {
      if (bar[i].value !== 16) return;
      const prev = k > 0 && bar[group[k - 1]].value === 16;
      const next = k < group.length - 1 && bar[group[k + 1]].value === 16;
      const sy = stemTop + BEAM_GAP;
      if (next) {
        const a = stemX(xs[i]) - 0.8;
        const z = stemX(xs[group[k + 1]]) + 0.8;
        parts.push(<Rect key={`b2${gi}-${k}`} x={a} y={sy} width={z - a} height={BEAM_W} fill={beamColor} />);
      } else if (!prev) {
        const sx = stemX(xs[i]);
        const towardsRight = k === 0;
        const stub = 9;
        parts.push(
          <Rect
            key={`b2${gi}-${k}`}
            x={towardsRight ? sx - 0.8 : sx - stub}
            y={sy}
            width={stub + 0.8}
            height={BEAM_W}
            fill={beamColor}
          />,
        );
      }
    });
  });

  if (cursor && !cursor.selectedId && cursor.staffId === staff.id && cursor.bar === barIndex) {
    let cx: number;
    if (cursor.index < bar.length) cx = xs[cursor.index] - HEAD_RX - 6;
    else if (used >= capacity) cx = right - 5;
    else cx = noteX(system, b, used, sig) + 3;
    parts.push(
      <G key="cursor">
        <Line x1={cx} y1={y - 28} x2={cx} y2={y + 16} stroke={colors.accent} strokeWidth={2.5} strokeLinecap="round" />
        <Rect x={cx - 4} y={y - 32} width={8} height={5} rx={2} fill={colors.accent} />
      </G>,
    );
  }
  return <G>{parts}</G>;
}

const SystemView = memo(function SystemView(props: Props & { system: SystemLayout; isLast: boolean }) {
  const { song, active, width, system, isLast, onTapEvent, onTapBar, onTapLabel, readOnly } = props;
  const cursor = readOnly ? null : props.cursor;
  const highlightStaff = !readOnly && props.highlightStaff;
  const height = song.staves.length * ROW_H + SYSTEM_GAP;
  const endX = barX(system, system.count);
  const bars = Array.from({ length: system.count }, (_, b) => system.first + b);

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        {song.staves.map((staff, r) => {
          const top = r * ROW_H;
          const y = top + LINE_Y;
          const editing = highlightStaff && cursor?.staffId === staff.id;
          return (
            <G key={staff.id}>
              {editing && <Rect x={0} y={top + 2} width={endX} height={ROW_H - 4} rx={14} fill="#F1EEFF" />}
              {cursor?.staffId === staff.id && bars.includes(cursor.bar) && (
                <Rect
                  x={barX(system, cursor.bar - system.first) + 2}
                  y={top + 6}
                  width={system.barW - 4}
                  height={ROW_H - 12}
                  rx={12}
                  fill={editing ? '#E6E1FF' : '#F4F1FF'}
                />
              )}
              <Line x1={HEADER_W - 18} y1={y} x2={endX} y2={y} stroke={colors.staff} strokeWidth={1.4} />
              <PercussionClef x={HEADER_W - 16} y={y} />
              {system.showSig && (
                <G>
                  <SvgText x={HEADER_W + SIG_W / 2} y={y - 4} fontSize={19} fontWeight="900" fill={colors.ink} textAnchor="middle">
                    {song.sig.beats}
                  </SvgText>
                  <SvgText x={HEADER_W + SIG_W / 2} y={y + 18} fontSize={19} fontWeight="900" fill={colors.ink} textAnchor="middle">
                    {song.sig.unit}
                  </SvgText>
                </G>
              )}
              {bars.map((barIndex, b) => {
                const x = barX(system, b + 1);
                const final = isLast && b === system.count - 1;
                return (
                  <G key={barIndex}>
                    <BarContents
                      staff={staff}
                      bar={staff.bars[barIndex]}
                      barIndex={barIndex}
                      b={b}
                      system={system}
                      sig={song.sig}
                      y={y}
                      cursor={cursor}
                      active={active}
                      showGaps={!readOnly}
                    />
                    {final ? (
                      <G>
                        <Line x1={x - 7} y1={y - 14} x2={x - 7} y2={y + 14} stroke={colors.ink} strokeWidth={1.4} />
                        <Rect x={x - 4} y={y - 14} width={3.5} height={28} fill={colors.ink} />
                      </G>
                    ) : (
                      <Line x1={x - 1} y1={y - 14} x2={x - 1} y2={y + 14} stroke={colors.ink} strokeWidth={1.4} />
                    )}
                  </G>
                );
              })}
            </G>
          );
        })}
        {song.staves.length > 1 && (
          <Rect x={HEADER_W - 22} y={LINE_Y - 16} width={2.5} height={(song.staves.length - 1) * ROW_H + 32} fill={colors.ink} />
        )}
      </Svg>

      {song.staves.map((staff, r) => {
        const top = r * ROW_H;
        return (
          <View key={staff.id} style={{ position: 'absolute', left: 0, right: 0, top, height: ROW_H }} pointerEvents="box-none">
            {!readOnly && (
              <>
                {bars.map((barIndex, b) => (
                  <Pressable
                    key={`bar${barIndex}`}
                    accessibilityRole="button"
                    accessibilityLabel={`${instrument(staff.instrument).name.en} bar ${barIndex + 1}`}
                    onPress={() => onTapBar(staff.id, barIndex)}
                    style={[styles.hit, { left: barX(system, b), width: system.barW }]}
                  />
                ))}
                {bars.map((barIndex, b) => {
                  const bar = staff.bars[barIndex];
                  const offsets = eventOffsets(bar);
                  return bar.map((e, i) => {
                    const x0 = noteX(system, b, offsets[i], song.sig);
                    const x1 = noteX(system, b, offsets[i] + eventUnits(e), song.sig);
                    return (
                      <Pressable
                        key={e.id}
                        accessibilityRole="button"
                        accessibilityLabel={`${e.rest ? 'rest' : 'note'} 1/${e.value}${e.dotted ? ' dotted' : ''}`}
                        onPress={() => onTapEvent(staff.id, e.id)}
                        style={[styles.hit, { left: x0, width: Math.max(18, x1 - x0) }]}
                      />
                    );
                  });
                })}
              </>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={instrument(staff.instrument).name.en}
              disabled={readOnly || !onTapLabel}
              onPress={() => onTapLabel?.(staff.id)}
              style={[styles.label, staff.muted && { opacity: 0.45 }]}
            >
              <Text style={styles.labelEmoji}>{instrument(staff.instrument).emoji}</Text>
              {staff.muted && <Text style={styles.mutedBadge}>🔇</Text>}
            </Pressable>
          </View>
        );
      })}
    </View>
  );
});

export function Score(props: Props) {
  const systems = layoutSystems(props.song.staves[0]?.bars.length ?? 1, props.width, props.song.sig);
  return (
    <View>
      {systems.map((system, i) => (
        <SystemView key={system.first} {...props} system={system} isLast={i === systems.length - 1} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  hit: { position: 'absolute', top: 0, bottom: 0 },
  label: { position: 'absolute', left: 0, top: LINE_Y - 44, width: HEADER_W - 4, height: 28, alignItems: 'center', justifyContent: 'center' },
  labelEmoji: { fontSize: 18 },
  mutedBadge: { position: 'absolute', right: -2, bottom: -4, fontSize: 11 },
});
