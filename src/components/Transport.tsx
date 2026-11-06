import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { hapticTap } from '../lib/feedback';
import { clickAccents, TIME_SIGNATURES, timeSigKey, type TimeSig } from '../lib/rhythm';
import { useSettings } from '../lib/settings';
import type { Song } from '../lib/song';
import type { usePlayback } from '../lib/usePlayback';
import { Chip, Sheet } from './ui';
import { colors, radius, shadow } from './theme';

type Playback = ReturnType<typeof usePlayback>;

/** The metronome's beats for one bar; the one sounding lights up. */
function BeatDots({ sig, beat, centered }: { sig: TimeSig; beat: Playback['beat']; centered?: boolean }) {
  const accents = clickAccents(sig);
  return (
    <View style={[styles.dots, centered && styles.centered]} accessibilityRole="none">
      {accents.map((a, i) => {
        const on = beat?.beat === i;
        const size = a === 2 ? 18 : a === 1 ? 14 : 11;
        return (
          <View
            key={i}
            style={[
              styles.dot,
              { width: size, height: size, borderRadius: size / 2 },
              on && { backgroundColor: beat?.countIn ? colors.accent : colors.success, transform: [{ scale: 1.25 }] },
            ]}
          />
        );
      })}
    </View>
  );
}

export function Transport({
  song,
  playback,
  onTempo,
  onSig,
  compact,
}: {
  song: Song;
  playback: Playback;
  onTempo: (tempo: number) => void;
  onSig: (sig: TimeSig) => void;
  /** Play mode: only play, tempo and the beat; no time signature or playback options. */
  compact?: boolean;
}) {
  const settings = useSettings();
  const { t } = settings;
  const [sigOpen, setSigOpen] = useState(false);

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={playback.playing ? t.stop : t.play}
          onPress={() => {
            hapticTap();
            playback.toggle();
          }}
          style={({ pressed }) => [styles.play, playback.playing && { backgroundColor: colors.error }, pressed && styles.pressed]}
        >
          <Text style={styles.playIcon}>{playback.playing ? '■' : '▶'}</Text>
        </Pressable>

        <View style={styles.tempo}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="-1"
            onPress={() => onTempo(song.tempo - 1)}
            onLongPress={() => onTempo(song.tempo - 10)}
            style={styles.step}
          >
            <Text style={styles.stepText}>−</Text>
          </Pressable>
          <View style={styles.tempoValue}>
            <Text style={styles.tempoNumber}>{song.tempo}</Text>
            <Text style={styles.tempoLabel}>{t.bpm}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="+1"
            onPress={() => onTempo(song.tempo + 1)}
            onLongPress={() => onTempo(song.tempo + 10)}
            style={styles.step}
          >
            <Text style={styles.stepText}>+</Text>
          </Pressable>
        </View>

        {!compact && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.chooseTimeSig}
            onPress={() => setSigOpen(true)}
            style={({ pressed }) => [styles.sig, pressed && styles.pressed]}
          >
            <Text style={styles.sigTop}>{song.sig.beats}</Text>
            <View style={styles.sigLine} />
            <Text style={styles.sigTop}>{song.sig.unit}</Text>
          </Pressable>
        )}
      </View>

      <View style={[styles.row, compact && styles.centered]}>
        {!compact && <Text style={styles.metronome}>{t.metronome}</Text>}
        <BeatDots sig={song.sig} beat={playback.beat} centered={compact} />
      </View>

      {!compact && (
        <View style={styles.toggles}>
          <Chip
            small
            label={settings.notesAudible ? `🔊 ${t.notesOn}` : `🔇 ${t.notesOff}`}
            active={settings.notesAudible}
            color={colors.success}
            onPress={() => settings.set({ notesAudible: !settings.notesAudible })}
          />
          <Chip small label={`🔁 ${t.loop}`} active={settings.loop} onPress={() => settings.set({ loop: !settings.loop })} />
          <Chip small label={`⏱ ${t.countIn}`} active={settings.countIn} onPress={() => settings.set({ countIn: !settings.countIn })} />
        </View>
      )}

      <Sheet visible={sigOpen} title={t.chooseTimeSig} onClose={() => setSigOpen(false)} closeLabel={t.close}>
        <View style={styles.sigGrid}>
          {TIME_SIGNATURES.map((s) => {
            const key = timeSigKey(s);
            const grouped = !s.groups.every((g) => g === 1);
            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={key}
                onPress={() => {
                  hapticTap();
                  onSig(s);
                  setSigOpen(false);
                }}
                style={[styles.sigOption, timeSigKey(song.sig) === key && styles.sigOptionActive]}
              >
                <Text style={styles.sigOptionText}>
                  {s.beats}/{s.unit}
                </Text>
                {grouped && <Text style={styles.sigGroups}>{s.groups.join('+')}</Text>}
              </Pressable>
            );
          })}
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 12, gap: 8, marginHorizontal: 16, ...shadow },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  play: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  playIcon: { color: '#fff', fontSize: 28, fontWeight: '900', marginLeft: 2 },
  pressed: { transform: [{ scale: 0.94 }] },
  tempo: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  step: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 26, fontWeight: '900', color: colors.primary, marginTop: -2 },
  tempoValue: { alignItems: 'center', minWidth: 64 },
  tempoNumber: { fontSize: 28, fontWeight: '900', color: colors.ink },
  tempoLabel: { fontSize: 12, fontWeight: '700', color: colors.muted, marginTop: -4 },
  sig: {
    width: 52,
    height: 64,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sigTop: { fontSize: 20, fontWeight: '900', color: colors.ink, lineHeight: 22 },
  sigLine: { width: 22, height: 2, backgroundColor: colors.ink, marginVertical: 1 },
  metronome: { fontSize: 13, fontWeight: '800', color: colors.muted, textTransform: 'uppercase' },
  dots: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  dot: { backgroundColor: colors.border },
  centered: { justifyContent: 'center' },
  toggles: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  sigGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  sigOption: {
    width: 92,
    height: 72,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sigOptionActive: { borderColor: colors.primary, backgroundColor: '#F1EEFF' },
  sigOptionText: { fontSize: 24, fontWeight: '900', color: colors.ink },
  sigGroups: { fontSize: 13, fontWeight: '800', color: colors.muted },
});
