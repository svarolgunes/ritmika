import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { canDot, NOTE_VALUES, type NoteEvent, type NoteValue } from '../lib/rhythm';
import { useSettings } from '../lib/settings';
import { changeSelected, deleteAtCursor, insertNote } from '../lib/song';
import type { useEditor } from '../lib/useEditor';
import { NoteGlyph, RestGlyph } from './glyphs';
import { colors, radius, shadow } from './theme';

type Editor = ReturnType<typeof useEditor>;

export function ValueGlyph({ value, rest, dotted, color = colors.ink }: { value: NoteValue; rest: boolean; dotted: boolean; color?: string }) {
  return (
    <Svg width={40} height={46}>
      {rest ? (
        <>
          {value <= 2 && <Line x1={6} y1={24} x2={30} y2={24} stroke={colors.staff} strokeWidth={1.4} />}
          <RestGlyph cx={18} y={24} value={value} dotted={dotted} color={color} />
        </>
      ) : (
        <NoteGlyph cx={14} y={38} value={value} dotted={dotted} color={color} />
      )}
    </Svg>
  );
}

/** Note values to add, plus note/rest, dot and delete. Works on the editor's cursor or selection. */
export function Palette({ editor }: { editor: Editor }) {
  const { t } = useSettings();
  const [rest, setRest] = useState(false);
  const [dotted, setDotted] = useState(false);

  const selected = useMemo<NoteEvent | null>(() => {
    if (!editor.cursor.selectedId) return null;
    for (const staff of editor.song.staves) {
      for (const bar of staff.bars) {
        const e = bar.find((x) => x.id === editor.cursor.selectedId);
        if (e) return e;
      }
    }
    return null;
  }, [editor.cursor.selectedId, editor.song]);

  // Selecting a note shows its kind and dot, so the buttons always tell the truth.
  useEffect(() => {
    if (selected) {
      setRest(selected.rest);
      setDotted(selected.dotted);
    }
  }, [selected]);

  const onValue = (value: NoteValue) => {
    if (selected) editor.edit((s, c) => changeSelected(s, c, { value, dotted: dotted && canDot(value) }));
    else editor.edit((s, c) => insertNote(s, c, { value, rest, dotted }));
  };

  const onRest = (next: boolean) => {
    setRest(next);
    if (selected) editor.edit((s, c) => changeSelected(s, c, { rest: next }));
  };

  const onDot = () => {
    const next = !dotted;
    if (selected && !editor.edit((s, c) => changeSelected(s, c, { dotted: next })).message) setDotted(next);
    else if (!selected) setDotted(next);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.values}>
        {NOTE_VALUES.map((v) => {
          const disabled = dotted && !canDot(v);
          const isSelected = selected?.value === v;
          return (
            <Pressable
              key={v}
              accessibilityRole="button"
              accessibilityLabel={`${rest ? t.rest : t.note} 1/${v}`}
              onPress={() => onValue(v)}
              style={({ pressed }) => [styles.value, isSelected && styles.valueSelected, disabled && { opacity: 0.35 }, pressed && styles.pressed]}
            >
              <ValueGlyph value={v} rest={rest} dotted={dotted && canDot(v)} color={isSelected ? colors.accent : colors.ink} />
            </Pressable>
          );
        })}
      </View>
      <View style={styles.tools}>
        <View style={styles.segment}>
          {[false, true].map((r) => (
            <Pressable
              key={String(r)}
              accessibilityRole="button"
              accessibilityState={{ selected: rest === r }}
              onPress={() => onRest(r)}
              style={[styles.segmentItem, rest === r && styles.segmentActive]}
            >
              <Text style={[styles.toolText, rest === r && { color: '#fff' }]}>{r ? t.rest : t.note}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: dotted }}
          onPress={onDot}
          style={[styles.tool, dotted && styles.toolActive]}
        >
          <Text style={[styles.toolText, dotted && { color: '#fff' }]}>● {t.dot}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.delete}
          onPress={() => editor.edit(deleteAtCursor)}
          style={[styles.tool, { borderColor: colors.error }]}
        >
          <Text style={[styles.toolText, { color: colors.error }]}>⌫</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 8,
    ...shadow,
  },
  values: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  value: {
    flex: 1,
    maxWidth: 76,
    height: 58,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueSelected: { borderColor: colors.accent, backgroundColor: '#FFF1EA' },
  pressed: { transform: [{ scale: 0.94 }] },
  tools: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  segment: { flexDirection: 'row', borderRadius: 20, borderWidth: 2, borderColor: colors.primary, overflow: 'hidden' },
  segmentItem: { paddingHorizontal: 16, height: 40, justifyContent: 'center' },
  segmentActive: { backgroundColor: colors.primary },
  tool: { paddingHorizontal: 14, height: 44, borderRadius: 22, borderWidth: 2, borderColor: colors.primary, justifyContent: 'center' },
  toolActive: { backgroundColor: colors.primary },
  toolText: { fontSize: 15, fontWeight: '800', color: colors.primary },
});
