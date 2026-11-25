import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PianoKeys } from '../../../components/PianoKeys';
import { StarRow } from '../../../components/StarRow';
import { colors, radius, shadow } from '../../../components/theme';
import { Card, Chip } from '../../../components/ui';
import { hapticError, hapticSuccess, hapticTap } from '../../../lib/feedback';
import {
  CHORD_IDS,
  INTERVALS,
  makeQuestion,
  NOTE_OFFSETS,
  soundOfChoice,
  starsFor,
  type ChordId,
  type Direction,
  type GameConfig,
  type GameKind,
  type Question,
} from '../../../lib/ear/game';
import { choiceColor, choiceLabel } from '../../../lib/ear/labels';
import { LESSON_LENGTH, lessonById, nextLesson, type Lesson } from '../../../lib/ear/lessons';
import { playNote, playSequence, preparePiano, stopPiano } from '../../../lib/ear/piano';
import { recordStars } from '../../../lib/ear/progress';
import { EAR_STRINGS } from '../../../lib/ear/strings';
import { useSettings } from '../../../lib/settings';

const FREE_DEFAULTS: Record<GameKind, GameConfig> = {
  compare: { kind: 'compare', minGap: 3, maxGap: 7, allowSame: false },
  note: { kind: 'note', pool: [0, 2, 4, 5, 7], reference: true },
  interval: { kind: 'interval', pool: [3, 4, 5, 7, 12], direction: 'up' },
  chord: { kind: 'chord', pool: ['major', 'minor'], style: 'block' },
};

const COMPARE_LEVELS = [
  { key: 'easy', minGap: 7, maxGap: 12 },
  { key: 'medium', minGap: 3, maxGap: 7 },
  { key: 'hard', minGap: 1, maxGap: 3 },
] as const;

const isGame = (g: unknown): g is GameKind => g === 'compare' || g === 'note' || g === 'interval' || g === 'chord';

/** One guessing game: a lesson of ten questions, or free play with its own settings. */
export default function EarPlay() {
  const params = useLocalSearchParams<{ lesson?: string; game?: string }>();
  const lesson = params.lesson ? lessonById(params.lesson) : undefined;
  const [freeConfig, setFreeConfig] = useState<GameConfig>(FREE_DEFAULTS[isGame(params.game) ? params.game : 'note']);
  const config = lesson ? lesson.config : freeConfig;
  // A new lesson or new free-play settings start a fresh round.
  return <Round key={lesson ? lesson.id : JSON.stringify(freeConfig)} config={config} lesson={lesson} onFreeConfig={setFreeConfig} />;
}

function Round({ config, lesson, onFreeConfig }: { config: GameConfig; lesson: Lesson | undefined; onFreeConfig: (c: GameConfig) => void }) {
  const { lang, a4, noteVolume } = useSettings();
  const s = EAR_STRINGS[lang];

  const [question, setQuestion] = useState<Question | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [results, setResults] = useState<boolean[]>([]);
  const [streak, setStreak] = useState(0);
  const [finished, setFinished] = useState(false);
  const questionRef = useRef<Question | null>(null);
  const asked = results.length;
  const right = results.filter(Boolean).length;

  const play = useCallback((q: Pick<Question, 'playback'>) => playSequence(q.playback, a4, noteVolume), [a4, noteVolume]);

  const ask = useCallback(
    (cfg: GameConfig) => {
      const q = makeQuestion(cfg, Math.random, questionRef.current);
      questionRef.current = q;
      setQuestion(q);
      setPicked(null);
      play(q);
    },
    [play],
  );

  useEffect(() => {
    let cancelled = false;
    preparePiano().then(() => {
      if (!cancelled) ask(config);
    });
    return () => {
      cancelled = true;
    };
    // Only when the round starts; the key on <Round> restarts it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => stopPiano, []);

  const answer = (choice: string) => {
    if (!question) return;
    if (picked !== null) {
      // After answering, the buttons play what each choice sounds like.
      const sound = soundOfChoice(config, question, choice);
      if (sound) play(sound);
      return;
    }
    setPicked(choice);
    setResults((r) => [...r, choice === question.answer]);
    if (choice === question.answer) {
      hapticSuccess();
      setStreak((n) => n + 1);
    } else {
      hapticError();
      setStreak(0);
    }
  };

  const next = () => {
    if (lesson && asked >= LESSON_LENGTH) {
      stopPiano();
      recordStars(lesson.id, starsFor(right, LESSON_LENGTH));
      setFinished(true);
      return;
    }
    ask(config);
  };

  const restart = () => {
    setResults([]);
    setStreak(0);
    setFinished(false);
    ask(config);
  };

  const title = lesson ? s.lessons[lesson.id] : s.games[config.kind];
  const following = lesson ? nextLesson(lesson) : undefined;
  const stars = starsFor(right, LESSON_LENGTH);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.top}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={s.back}
          onPress={() => {
            stopPiano();
            if (router.canGoBack()) router.back();
            else router.replace('/ear');
          }}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={2}>
            {lesson ? `${lesson.emoji} ` : `${s.gameEmoji[config.kind]} `}
            {title}
          </Text>
          <Text style={styles.subtitle}>{s.gameHints[config.kind]}</Text>
        </View>
        <View style={styles.score}>
          <Text style={styles.scoreText}>✓ {s.score(right, asked)}</Text>
          {streak >= 2 && <Text style={styles.streak}>{s.streak(streak)}</Text>}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {lesson && !finished && (
          <View style={styles.dots} accessibilityLabel={s.question(Math.min(asked + (picked ? 0 : 1), LESSON_LENGTH), LESSON_LENGTH)}>
            {Array.from({ length: LESSON_LENGTH }, (_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i < asked && { backgroundColor: results[i] ? colors.success : colors.error },
                  i === asked && !picked && styles.dotCurrent,
                ]}
              />
            ))}
          </View>
        )}

        {finished ? (
          <Card style={styles.result}>
            <Text style={styles.resultTitle}>{s.lessonDone}</Text>
            <StarRow stars={stars} size={52} />
            <Text style={styles.resultText}>{s.lessonResult(right, LESSON_LENGTH)}</Text>
            {stars === 0 && <Text style={styles.resultHint}>{s.tryForStar}</Text>}
            <View style={styles.row}>
              <Chip label={`🔁 ${s.again}`} onPress={restart} />
              {following && stars > 0 && (
                <Chip label={s.nextLesson} active onPress={() => router.replace({ pathname: '/ear/play', params: { lesson: following.id } })} />
              )}
            </View>
          </Card>
        ) : (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={s.listenAgain}
              onPress={() => {
                hapticTap();
                if (question) play(question);
              }}
              style={({ pressed }) => [styles.listen, pressed && styles.pressed]}
            >
              <Text style={styles.listenIcon}>🔊</Text>
              <Text style={styles.listenText}>{s.listenAgain}</Text>
            </Pressable>

            {question && (
              <View style={styles.choices}>
                {question.choices.map((c) => {
                  const color = choiceColor(config.kind, c);
                  const isAnswer = picked !== null && c === question.answer;
                  const isWrongPick = picked === c && c !== question.answer;
                  const faded = picked !== null && !isAnswer && !isWrongPick;
                  return (
                    <Pressable
                      key={c}
                      accessibilityRole="button"
                      accessibilityLabel={choiceLabel(config.kind, c, s, lang)}
                      onPress={() => answer(c)}
                      style={({ pressed }) => [
                        styles.choice,
                        question.choices.length <= 3 && styles.choiceWide,
                        { borderColor: color, backgroundColor: isAnswer ? color : `${color}22` },
                        isWrongPick && styles.choiceWrong,
                        faded && { opacity: 0.55 },
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={[styles.choiceText, isAnswer && { color: '#fff' }]} numberOfLines={2} adjustsFontSizeToFit>
                        {isAnswer ? '✓ ' : isWrongPick ? '✗ ' : ''}
                        {choiceLabel(config.kind, c, s, lang)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {question && picked !== null && (
              <Card style={styles.feedback}>
                <Text style={[styles.feedbackText, { color: picked === question.answer ? colors.success : colors.error }]}>
                  {picked === question.answer ? s.correct[right % s.correct.length] : s.wrong(choiceLabel(config.kind, question.answer, s, lang))}
                </Text>
                <PianoKeys notes={question.notes} lang={lang} onKey={(n) => playNote(n, a4, noteVolume)} />
                {config.kind !== 'compare' && <Text style={styles.tip}>{s.compareTip}</Text>}
                <View style={styles.row}>
                  <Chip small label={`🔊 ${s.listenAgain}`} onPress={() => play(question)} />
                  <Chip label={`${s.next} ➜`} active onPress={next} />
                </View>
              </Card>
            )}

            {!lesson && <FreeSettings config={config} onChange={onFreeConfig} />}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Free-play settings: which answers can come up and how the notes are played. */
function FreeSettings({ config, onChange }: { config: GameConfig; onChange: (c: GameConfig) => void }) {
  const { lang } = useSettings();
  const s = EAR_STRINGS[lang];
  const [warn, setWarn] = useState(false);

  /** Turns a choice on or off, keeping at least two. */
  const toggle = <T,>(pool: T[], item: T): T[] | null => {
    const has = pool.includes(item);
    if (has && pool.length <= 2) {
      setWarn(true);
      return null;
    }
    setWarn(false);
    return has ? pool.filter((p) => p !== item) : [...pool, item];
  };

  const options = (() => {
    switch (config.kind) {
      case 'compare':
        return (
          <>
            <View style={styles.row}>
              {COMPARE_LEVELS.map((l) => (
                <Chip
                  key={l.key}
                  small
                  label={s[l.key]}
                  active={config.minGap === l.minGap && config.maxGap === l.maxGap}
                  onPress={() => onChange({ ...config, minGap: l.minGap, maxGap: l.maxGap })}
                />
              ))}
            </View>
            <View style={styles.row}>
              <Chip small label={s.allowSame} active={config.allowSame} onPress={() => onChange({ ...config, allowSame: !config.allowSame })} />
            </View>
          </>
        );
      case 'note':
        return (
          <>
            <View style={styles.row}>
              {NOTE_OFFSETS.map((o) => (
                <Chip
                  key={o}
                  small
                  label={choiceLabel('note', String(o), s, lang)}
                  color={choiceColor('note', String(o))}
                  active={config.pool.includes(o)}
                  onPress={() => {
                    const pool = toggle(config.pool, o);
                    if (pool) onChange({ ...config, pool });
                  }}
                />
              ))}
            </View>
            <View style={styles.row}>
              <Chip small label={`🔑 ${s.referenceDo}`} active={config.reference} onPress={() => onChange({ ...config, reference: !config.reference })} />
            </View>
          </>
        );
      case 'interval':
        return (
          <>
            <View style={styles.row}>
              {INTERVALS.filter((i) => i > 0).map((i) => (
                <Chip
                  key={i}
                  small
                  label={s.intervals[i]}
                  color={choiceColor('interval', String(i))}
                  active={config.pool.includes(i)}
                  onPress={() => {
                    const pool = toggle(config.pool, i);
                    if (pool) onChange({ ...config, pool });
                  }}
                />
              ))}
            </View>
            <View style={styles.row}>
              {(['up', 'down', 'together', 'mixed'] as Direction[]).map((d) => (
                <Chip key={d} small label={s.directions[d]} active={config.direction === d} onPress={() => onChange({ ...config, direction: d })} />
              ))}
            </View>
          </>
        );
      case 'chord':
        return (
          <>
            <View style={styles.row}>
              {CHORD_IDS.map((c: ChordId) => (
                <Chip
                  key={c}
                  small
                  label={s.chords[c]}
                  color={choiceColor('chord', c)}
                  active={config.pool.includes(c)}
                  onPress={() => {
                    const pool = toggle(config.pool, c);
                    if (pool) onChange({ ...config, pool });
                  }}
                />
              ))}
            </View>
            <View style={styles.row}>
              <Chip small label={s.arpeggio} active={config.style === 'arpeggio'} onPress={() => onChange({ ...config, style: 'arpeggio' })} />
              <Chip small label={s.block} active={config.style === 'block'} onPress={() => onChange({ ...config, style: 'block' })} />
            </View>
          </>
        );
    }
  })();

  return (
    <Card style={styles.settings}>
      <Text style={styles.settingsTitle}>⚙️ {s.choose}</Text>
      {options}
      {warn && <Text style={styles.warn}>{s.pickTwo}</Text>}
    </Card>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4, maxWidth: 720, width: '100%', alignSelf: 'center' },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadow },
  backText: { fontSize: 30, fontWeight: '900', color: colors.primary, marginTop: -4 },
  title: { fontSize: 22, fontWeight: '900', color: colors.ink },
  subtitle: { fontSize: 13, fontWeight: '600', color: colors.muted },
  score: { alignItems: 'flex-end' },
  scoreText: { fontSize: 16, fontWeight: '900', color: colors.ink },
  streak: { fontSize: 14, fontWeight: '900', color: colors.accent },
  content: { padding: 16, gap: 14, maxWidth: 720, width: '100%', alignSelf: 'center', paddingBottom: 40 },
  dots: { flexDirection: 'row', gap: 6, justifyContent: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.border },
  dotCurrent: { backgroundColor: colors.accent, transform: [{ scale: 1.25 }] },
  listen: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.primary,
    paddingHorizontal: 28,
    height: 72,
    borderRadius: 36,
    ...shadow,
  },
  listenIcon: { fontSize: 30 },
  listenText: { fontSize: 20, fontWeight: '900', color: '#fff' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  choice: {
    flexGrow: 1,
    flexBasis: '30%',
    minHeight: 64,
    borderRadius: radius.md,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  choiceWide: { flexBasis: '40%', minHeight: 80 },
  choiceWrong: { borderColor: colors.error, backgroundColor: `${colors.error}33` },
  choiceText: { fontSize: 18, fontWeight: '900', color: colors.ink, textAlign: 'center' },
  feedback: { padding: 14, gap: 12 },
  feedbackText: { fontSize: 20, fontWeight: '900', textAlign: 'center' },
  tip: { fontSize: 13, fontWeight: '600', color: colors.muted, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  result: { padding: 20, gap: 12, alignItems: 'center' },
  resultTitle: { fontSize: 26, fontWeight: '900', color: colors.ink },
  resultText: { fontSize: 18, fontWeight: '800', color: colors.ink },
  resultHint: { fontSize: 15, fontWeight: '700', color: colors.muted, textAlign: 'center' },
  settings: { padding: 14, gap: 10 },
  settingsTitle: { fontSize: 17, fontWeight: '900', color: colors.ink },
  warn: { fontSize: 13, fontWeight: '700', color: colors.error },
  pressed: { transform: [{ scale: 0.96 }] },
});
