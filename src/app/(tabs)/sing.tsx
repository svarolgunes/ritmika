import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PitchTrail } from '../../components/PitchTrail';
import { colors, radius, shadow } from '../../components/theme';
import { TunerMeter } from '../../components/TunerMeter';
import { Card, Chip, Header } from '../../components/ui';
import { hapticSuccess, hapticTap } from '../../lib/feedback';
import { matchHint, MATCH_OCTAVES, MATCH_SECONDS, NEW_MATCH, scaleNotes, stepMatch, type MatchState } from '../../lib/pitch/match';
import { nearestNote, noteColor, noteName, octaveOf } from '../../lib/pitch/notes';
import type { PitchFrame } from '../../lib/pitch/tracker';
import { playTone, prepareTones, TONE_MS } from '../../lib/pitch/tones';
import { useSettings } from '../../lib/settings';
import { usePitch } from '../../lib/usePitch';

/** Live pitch: sing or play, and see the note, how in tune it is, and its line. */
export default function SingScreen() {
  const { t, lang, a4, matchOctave, set } = useSettings();
  const scale = scaleNotes(matchOctave);
  const [width, setWidth] = useState(0);
  const [target, setTarget] = useState<number | null>(null);
  const [match, setMatch] = useState<MatchState>(NEW_MATCH);
  const [stars, setStars] = useState(0);

  // The game advances on every pitch frame, in the mic's callback rather than on render.
  const matchRef = useRef<MatchState>(NEW_MATCH);
  const onFrame = useCallback(
    (f: PitchFrame, dt: number) => {
      if (target === null) return;
      const before = matchRef.current;
      const next = stepMatch(before, f.midi, target, dt);
      if (next === before) return;
      matchRef.current = next;
      setMatch(next);
      if (next.done && !before.done) {
        hapticSuccess();
        setStars((s) => s + 1);
      }
    },
    [target],
  );
  const pitch = usePitch(onFrame);
  const { frame, status } = pitch;
  const listening = status === 'listening';

  useEffect(() => {
    prepareTones();
  }, []);

  const reading = frame?.midi != null ? nearestNote(frame.midi) : null;
  const color = reading ? noteColor(reading.midi) : colors.muted;

  const pickTarget = (note: number) => {
    setTarget(note);
    matchRef.current = NEW_MATCH;
    setMatch(NEW_MATCH);
    playTone(note, a4);
    pitch.ignoreFor(TONE_MS);
    if (!listening) pitch.start();
  };

  /** Up the scale, Do Re Mi …, and round again. */
  const nextTarget = () => {
    const i = target === null ? -1 : scale.indexOf(target);
    pickTarget(scale[(i + 1) % scale.length]);
  };

  let message = t.listenPrompt;
  if (status === 'denied') message = t.micDenied;
  else if (status === 'error') message = t.micError;
  else if (listening && target !== null && frame?.midi != null && !match.done) {
    const h = matchHint(frame.midi, target);
    message = { inTune: t.inTune, higher: t.singHigher, lower: t.singLower, octaveUp: t.octaveUp, octaveDown: t.octaveDown }[h];
  } else if (listening && reading && Math.abs(reading.cents) <= 10) message = t.inTune;
  else if (listening) message = t.listening;

  const face = !reading ? '🎤' : Math.abs(reading.cents) <= 10 ? '😊' : Math.abs(reading.cents) <= 25 ? '🙂' : '😮';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <Header title={t.tabSing} subtitle={t.singSubtitle} right={stars > 0 ? <Text style={styles.stars}>⭐ {stars}</Text> : undefined} />
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.readout}>
          <View style={styles.noteBox}>
            <Text style={[styles.noteName, { color }]} numberOfLines={1} adjustsFontSizeToFit>
              {reading ? noteName(reading.midi, lang) : '–'}
              {reading && <Text style={styles.octave}>{octaveOf(reading.midi)}</Text>}
            </Text>
            <Text style={styles.hz}>{frame?.hz ? `${frame.hz.toFixed(1)} Hz` : ' '}</Text>
            <Text style={styles.face}>{face}</Text>
          </View>
          <TunerMeter cents={reading ? reading.cents : null} color={color} lowLabel={t.pitchLow} highLabel={t.pitchHigh} />
        </Card>

        <View style={styles.micRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={listening ? t.stop : t.listen}
            onPress={() => {
              hapticTap();
              if (listening || status === 'starting') pitch.stop();
              else pitch.start();
            }}
            style={({ pressed }) => [styles.mic, listening && { backgroundColor: colors.error }, pressed && styles.pressed]}
          >
            <Text style={styles.micIcon}>{listening ? '■' : '🎤'}</Text>
          </Pressable>
          <View style={styles.messageBox}>
            <Text style={[styles.message, (status === 'denied' || status === 'error') && { color: colors.error }]}>{message}</Text>
            {status === 'denied' && Platform.OS !== 'web' && (
              <Chip small label={t.openSettings} onPress={() => Linking.openSettings().catch(() => undefined)} style={styles.settingsChip} />
            )}
          </View>
        </View>

        <View style={styles.trailBox} onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}>
          {width > 0 && <PitchTrail trail={pitch.trail} width={width} height={230} lang={lang} target={target} />}
        </View>

        <Card style={styles.match}>
          <Text style={styles.cardTitle}>{t.matchTitle}</Text>
          <Text style={styles.small}>{t.matchHint}</Text>
          <View style={styles.row}>
            <Text style={styles.octaveLabel}>{t.octave}</Text>
            {MATCH_OCTAVES.map((o) => (
              <Chip
                key={o}
                small
                label={String(o)}
                accessibilityLabel={`${t.octave} ${o}`}
                active={matchOctave === o}
                onPress={() => {
                  if (o === matchOctave) return;
                  set({ matchOctave: o });
                  setTarget(null);
                  matchRef.current = NEW_MATCH;
                  setMatch(NEW_MATCH);
                }}
              />
            ))}
          </View>
          <View style={styles.notes}>
            {scale.map((n) => {
              const active = target === n;
              return (
                <Pressable
                  key={n}
                  accessibilityRole="button"
                  accessibilityLabel={`${noteName(n, lang)}${octaveOf(n)}`}
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    hapticTap();
                    pickTarget(n);
                  }}
                  style={({ pressed }) => [
                    styles.noteBubble,
                    { borderColor: noteColor(n), backgroundColor: active ? noteColor(n) : `${noteColor(n)}22` },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.noteBubbleText, { color: active ? '#fff' : colors.ink }]}>
                    {noteName(n, lang)}
                    <Text style={[styles.noteBubbleOctave, active && { color: '#fff' }]}>{octaveOf(n)}</Text>
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {target !== null && (
            <>
              <View style={styles.progress}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.min(100, (match.held / MATCH_SECONDS) * 100)}%`, backgroundColor: match.done ? colors.success : noteColor(target) },
                  ]}
                />
              </View>
              <View style={styles.row}>
                {match.done && <Text style={styles.done}>{t.matchDone}</Text>}
                <Chip small label={`🔈 ${t.listenAgain}`} onPress={() => pickTarget(target)} />
                {match.done && <Chip small label={`${t.next} ➜`} active onPress={nextTarget} />}
              </View>
            </>
          )}
        </Card>

        <Text style={styles.privacy}>🔒 {t.privacy}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 14, maxWidth: 720, width: '100%', alignSelf: 'center', paddingBottom: 32 },
  stars: { fontSize: 18, fontWeight: '900', color: colors.ink },
  readout: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-around', gap: 4, padding: 12 },
  noteBox: { alignItems: 'center', minWidth: 120 },
  noteName: { fontSize: 64, fontWeight: '900', lineHeight: 72 },
  octave: { fontSize: 26, fontWeight: '800', color: colors.muted },
  hz: { fontSize: 14, fontWeight: '700', color: colors.muted },
  face: { fontSize: 30, marginTop: 4 },
  micRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  messageBox: { flex: 1, gap: 8 },
  message: { fontSize: 17, fontWeight: '800', color: colors.ink },
  settingsChip: { alignSelf: 'flex-start' },
  trailBox: { width: '100%', borderRadius: 16, ...shadow, backgroundColor: colors.surface },
  mic: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  micIcon: { fontSize: 32, color: '#fff', fontWeight: '900' },
  pressed: { transform: [{ scale: 0.95 }] },
  match: { padding: 16, gap: 10 },
  cardTitle: { fontSize: 18, fontWeight: '900', color: colors.ink },
  small: { fontSize: 14, color: colors.muted, fontWeight: '600' },
  notes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  noteBubble: {
    minWidth: 52,
    height: 52,
    paddingHorizontal: 8,
    borderRadius: 26,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteBubbleText: { fontSize: 16, fontWeight: '900' },
  noteBubbleOctave: { fontSize: 11, fontWeight: '800', color: colors.muted },
  octaveLabel: { fontSize: 15, fontWeight: '800', color: colors.ink },
  progress: { height: 14, borderRadius: 7, backgroundColor: colors.border, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radius.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  done: { fontSize: 20, fontWeight: '900', color: colors.success },
  privacy: { textAlign: 'center', fontSize: 13, color: colors.muted, fontWeight: '600' },
});
