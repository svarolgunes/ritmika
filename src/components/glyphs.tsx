/**
 * Hand-drawn notation glyphs in SVG, so the app needs no music font.
 * Coordinates: `cx` is the centre of the notehead (or rest), `y` the staff line.
 */
import { Circle, Ellipse, G, Line, Path, Rect } from 'react-native-svg';

import type { NoteValue } from '../lib/rhythm';

export const HEAD_RX = 6.2;
export const STEM = 32;
export const BEAM_W = 4.6;
export const BEAM_GAP = 7;
const STEM_W = 1.6;

export const stemX = (cx: number) => cx + HEAD_RX - 0.8;

export function NoteHead({ cx, y, hollow, color }: { cx: number; y: number; hollow: boolean; color: string }) {
  return (
    <Ellipse
      cx={cx}
      cy={y}
      rx={HEAD_RX}
      ry={4.5}
      transform={`rotate(-20 ${cx} ${y})`}
      fill={hollow ? 'none' : color}
      stroke={color}
      strokeWidth={hollow ? 2 : 0}
    />
  );
}

function Flags({ x, top, count, color }: { x: number; top: number; count: number; color: string }) {
  return (
    <G>
      {Array.from({ length: count }, (_, i) => {
        const y = top + i * 7;
        return (
          <Path
            key={i}
            d={`M${x} ${y} C${x + 1} ${y + 7} ${x + 11} ${y + 9} ${x + 8} ${y + 19} C${x + 8.5} ${y + 12} ${x + 3} ${y + 10} ${x} ${y + 8.5} Z`}
            fill={color}
          />
        );
      })}
    </G>
  );
}

export function AugmentationDot({ cx, y, color }: { cx: number; y: number; color: string }) {
  return <Circle cx={cx + 11} cy={y - 3} r={2.2} fill={color} />;
}

type NoteProps = {
  cx: number;
  y: number;
  value: NoteValue;
  dotted: boolean;
  color: string;
  /** Set when the note is beamed: the stem then runs up to the beam and gets no flag. */
  stemTop?: number;
};

export function NoteGlyph({ cx, y, value, dotted, color, stemTop }: NoteProps) {
  const sx = stemX(cx);
  const top = stemTop ?? y - STEM;
  const flags = stemTop === undefined ? ({ 8: 1, 16: 2 } as Record<number, number>)[value] ?? 0 : 0;
  return (
    <G>
      <NoteHead cx={cx} y={y} hollow={value <= 2} color={color} />
      {value !== 1 && <Line x1={sx} y1={y - 1} x2={sx} y2={top} stroke={color} strokeWidth={STEM_W} />}
      {flags > 0 && <Flags x={sx} top={top} count={flags} color={color} />}
      {dotted && <AugmentationDot cx={cx} y={y} color={color} />}
    </G>
  );
}

export function RestGlyph({ cx, y, value, dotted, color }: { cx: number; y: number; value: NoteValue; dotted: boolean; color: string }) {
  let body;
  switch (value) {
    case 1:
      body = <Rect x={cx - 6.5} y={y} width={13} height={5.5} fill={color} />;
      break;
    case 2:
      body = <Rect x={cx - 6.5} y={y - 5.5} width={13} height={5.5} fill={color} />;
      break;
    case 4:
      body = (
        <Path
          d={`M${cx - 2.5} ${y - 15} L${cx + 3.5} ${y - 7.5} C${cx + 1} ${y - 5} ${cx - 0.5} ${y - 3} ${cx + 0.5} ${y - 0.5} L${cx + 4} ${y + 4} C${cx} ${y + 2.5} ${cx - 4} ${y + 4} ${cx - 0.5} ${y + 11} C${cx - 6} ${y + 6} ${cx - 3.5} ${y} ${cx + 0.5} ${y + 1} L${cx - 4} ${y - 5} C${cx - 1} ${y - 8} ${cx} ${y - 10} ${cx - 2.5} ${y - 15} Z`}
          fill={color}
          stroke={color}
          strokeWidth={1}
          strokeLinejoin="round"
        />
      );
      break;
    default: {
      // Eighth and sixteenth rests: a slanted stroke with one or two hooks.
      const hooks = value === 8 ? 1 : 2;
      const top = y - 9;
      body = (
        <G>
          <Line x1={cx + 4} y1={top} x2={cx - 1.5 - hooks} y2={y + 10 + (hooks - 1) * 3} stroke={color} strokeWidth={1.7} strokeLinecap="round" />
          {Array.from({ length: hooks }, (_, i) => {
            const hy = top + i * 7.5;
            const hx = cx + 4 - i * 2.2;
            return (
              <G key={i}>
                <Circle cx={hx - 6} cy={hy + 1.5} r={2.6} fill={color} />
                <Path d={`M${hx - 6} ${hy + 3.5} Q${hx - 2} ${hy + 4} ${hx} ${hy}`} stroke={color} strokeWidth={1.6} fill="none" />
              </G>
            );
          })}
        </G>
      );
    }
  }
  return (
    <G>
      {body}
      {dotted && <Circle cx={cx + 10} cy={y - 7} r={2.2} fill={color} />}
    </G>
  );
}

/** The percussion clef: two thick vertical bars. */
export function PercussionClef({ x, y }: { x: number; y: number }) {
  return (
    <G>
      <Rect x={x} y={y - 10} width={3.5} height={20} fill="#2B2340" />
      <Rect x={x + 6} y={y - 10} width={3.5} height={20} fill="#2B2340" />
    </G>
  );
}
