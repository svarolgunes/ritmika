import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Lang } from '../lib/i18n';
import { isNatural, noteColor, noteName } from '../lib/pitch/notes';
import { colors } from './theme';

/**
 * A small piano keyboard that lights up the given notes in their colours,
 * from the Do below the lowest one to the Si above the highest. Tapping a
 * key calls onKey, so the child can play the notes themselves.
 */
export function PianoKeys({ notes, lang, onKey, height = 110 }: { notes: number[]; lang: Lang; onKey?: (note: number) => void; height?: number }) {
  const [width, setWidth] = useState(0);
  if (notes.length === 0) return null;
  const lo = Math.floor(Math.min(...notes) / 12) * 12;
  const hi = Math.floor(Math.max(...notes) / 12) * 12 + 11;
  const keys: number[] = [];
  for (let n = lo; n <= hi; n += 1) keys.push(n);
  const whites = keys.filter(isNatural);
  const whiteW = width / whites.length;
  const blackW = whiteW * 0.6;
  const lit = new Set(notes);

  return (
    <View style={[styles.box, { height }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 &&
        whites.map((n, i) => {
          const on = lit.has(n);
          return (
            <Pressable
              key={n}
              accessibilityRole="button"
              accessibilityLabel={noteName(n, lang)}
              onPress={() => onKey?.(n)}
              style={[styles.white, { left: i * whiteW, width: whiteW - 2, height }, on && { backgroundColor: noteColor(n) }]}
            >
              {on && <Text style={styles.whiteLabel}>{noteName(n, lang)}</Text>}
            </Pressable>
          );
        })}
      {width > 0 &&
        keys
          .filter((n) => !isNatural(n))
          .map((n) => {
            // A black key sits on the line after the white key below it.
            const below = whites.indexOf(n - 1);
            const on = lit.has(n);
            return (
              <Pressable
                key={n}
                accessibilityRole="button"
                accessibilityLabel={noteName(n, lang)}
                onPress={() => onKey?.(n)}
                style={[styles.black, { left: (below + 1) * whiteW - blackW / 2 - 1, width: blackW, height: height * 0.6 }, on && { backgroundColor: noteColor(n) }]}
              >
                {on && <Text style={styles.blackLabel}>{noteName(n, lang)}</Text>}
              </Pressable>
            );
          })}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: '100%', position: 'relative' },
  white: {
    position: 'absolute',
    top: 0,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: colors.staff,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 6,
  },
  black: {
    position: 'absolute',
    top: 0,
    backgroundColor: colors.ink,
    borderBottomLeftRadius: 5,
    borderBottomRightRadius: 5,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 4,
    zIndex: 2,
  },
  whiteLabel: { color: '#fff', fontWeight: '900', fontSize: 12 },
  blackLabel: { color: '#fff', fontWeight: '900', fontSize: 8 },
});
