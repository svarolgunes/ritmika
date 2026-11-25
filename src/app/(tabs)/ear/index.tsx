import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, shadow } from '../../../components/theme';
import { StarRow } from '../../../components/StarRow';
import { Card, Header } from '../../../components/ui';
import { hapticError, hapticTap } from '../../../lib/feedback';
import type { GameKind } from '../../../lib/ear/game';
import { isUnlocked, lessonsOf, UNITS, type UnitId } from '../../../lib/ear/lessons';
import { preparePiano } from '../../../lib/ear/piano';
import { useLessonStars } from '../../../lib/ear/progress';
import { EAR_STRINGS } from '../../../lib/ear/strings';
import { useSettings } from '../../../lib/settings';

const GAMES: GameKind[] = ['compare', 'note', 'interval', 'chord'];
const UNIT_COLORS: Record<UnitId, string> = { highLow: '#3BB7D9', notes: '#F25F5C', intervals: '#4CC38A', chords: '#7B6CF6' };

/** The Kulak (Ear) tab: training lessons and free-play guessing games. */
export default function EarHome() {
  const { lang } = useSettings();
  const s = EAR_STRINGS[lang];
  const stars = useLessonStars();

  useEffect(() => {
    preparePiano();
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <Header title={s.title} subtitle={s.subtitle} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.section}>🎓 {s.trainings}</Text>
        <Text style={styles.hint}>{s.trainingsHint}</Text>
        {UNITS.map((unit) => {
          const lessons = lessonsOf(unit);
          const earned = lessons.reduce((n, l) => n + (stars[l.id] ?? 0), 0);
          return (
            <Card key={unit} style={styles.unit}>
              <View style={styles.unitHead}>
                <Text style={[styles.unitTitle, { color: UNIT_COLORS[unit] }]}>{s.units[unit]}</Text>
                <Text style={styles.unitStars}>
                  ⭐ {earned}/{lessons.length * 3}
                </Text>
              </View>
              {lessons.map((lesson, i) => {
                const open = isUnlocked(lesson, stars);
                const got = stars[lesson.id] ?? 0;
                return (
                  <Pressable
                    key={lesson.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${s.lessons[lesson.id]}${open ? '' : `, ${s.locked}`}`}
                    accessibilityState={{ disabled: !open }}
                    onPress={() => {
                      if (!open) {
                        hapticError();
                        return;
                      }
                      hapticTap();
                      router.push({ pathname: '/ear/play', params: { lesson: lesson.id } });
                    }}
                    style={({ pressed }) => [styles.lesson, !open && styles.lessonLocked, pressed && open && styles.pressed]}
                  >
                    <View style={[styles.badge, { backgroundColor: open ? `${UNIT_COLORS[unit]}22` : colors.border }]}>
                      <Text style={styles.badgeText}>{open ? lesson.emoji : '🔒'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.lessonTitle, !open && { color: colors.muted }]}>
                        {i + 1}. {s.lessons[lesson.id]}
                      </Text>
                    </View>
                    <StarRow stars={got} size={20} />
                  </Pressable>
                );
              })}
            </Card>
          );
        })}

        <Text style={[styles.section, { marginTop: 8 }]}>🎲 {s.freePlay}</Text>
        <Text style={styles.hint}>{s.freePlayHint}</Text>
        <View style={styles.games}>
          {GAMES.map((g) => (
            <Pressable
              key={g}
              accessibilityRole="button"
              accessibilityLabel={s.games[g]}
              onPress={() => {
                hapticTap();
                router.push({ pathname: '/ear/play', params: { game: g } });
              }}
              style={({ pressed }) => [styles.game, pressed && styles.pressed]}
            >
              <Text style={styles.gameEmoji}>{s.gameEmoji[g]}</Text>
              <Text style={styles.gameTitle}>{s.games[g]}</Text>
              <Text style={styles.gameHint}>{s.gameHints[g]}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 12, maxWidth: 720, width: '100%', alignSelf: 'center', paddingBottom: 32 },
  section: { fontSize: 22, fontWeight: '900', color: colors.ink },
  hint: { fontSize: 14, fontWeight: '600', color: colors.muted, marginTop: -6 },
  unit: { padding: 12, gap: 6 },
  unitHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  unitTitle: { flex: 1, fontSize: 18, fontWeight: '900' },
  unitStars: { fontSize: 14, fontWeight: '800', color: colors.muted },
  lesson: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, paddingHorizontal: 4, borderRadius: radius.sm },
  lessonLocked: { opacity: 0.6 },
  badge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 20 },
  lessonTitle: { fontSize: 16, fontWeight: '800', color: colors.ink },
  games: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  game: {
    flexGrow: 1,
    flexBasis: 150,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    gap: 4,
    ...shadow,
  },
  gameEmoji: { fontSize: 30 },
  gameTitle: { fontSize: 17, fontWeight: '900', color: colors.ink },
  gameHint: { fontSize: 13, fontWeight: '600', color: colors.muted },
  pressed: { transform: [{ scale: 0.97 }] },
});
