import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { instrument, INSTRUMENTS, type InstrumentId } from '../data/instruments';
import { songFromPreset, type Preset } from '../data/presets';
import { hapticTap } from '../lib/feedback';
import { describeUnits, type Strings } from '../lib/i18n';
import { useSettings } from '../lib/settings';
import {
  addBar,
  addStaff,
  clearSong,
  cursorToBarEnd,
  fillRests,
  MAX_STAVES,
  removeBar,
  removeStaff,
  selectEvent,
  setInstrument,
  setTempo,
  setTimeSig,
  toggleMute,
  type EditMessage,
  type Song,
} from '../lib/song';
import { useEditor } from '../lib/useEditor';
import { usePlayback } from '../lib/usePlayback';
import { Palette } from './Palette';
import { Score } from './Score';
import { colors, radius } from './theme';
import { Transport } from './Transport';
import { Card, Chip, Header, Sheet } from './ui';

function messageText(m: EditMessage, t: Strings) {
  switch (m.key) {
    case 'noRoom':
      return t.noRoom(m.remaining > 0 ? describeUnits(m.remaining, t) : '');
    case 'dropped':
      return t.dropped(m.count);
    case 'cantDot':
      return t.cantDot;
  }
}

function InstrumentGrid({ current, onPick }: { current?: InstrumentId; onPick: (id: InstrumentId) => void }) {
  const { lang } = useSettings();
  return (
    <View style={styles.grid}>
      {INSTRUMENTS.map((i) => (
        <Pressable
          key={i.id}
          accessibilityRole="button"
          accessibilityLabel={i.name[lang]}
          onPress={() => {
            hapticTap();
            onPick(i.id);
          }}
          style={({ pressed }) => [
            styles.instrument,
            { borderColor: current === i.id ? i.color : colors.border },
            current === i.id && { backgroundColor: `${i.color}22` },
            pressed && { transform: [{ scale: 0.95 }] },
          ]}
        >
          <Text style={styles.instrumentEmoji}>{i.emoji}</Text>
          <Text style={styles.instrumentName} numberOfLines={1}>
            {i.name[lang]}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

type Props = {
  storageKey: string;
  title: string;
  subtitle: string;
  presets: Preset[];
  ensemble: boolean;
};

export function EditorScreen({ storageKey, title, subtitle, presets, ensemble }: Props) {
  const { t, lang, editing, set } = useSettings();
  const editor = useEditor(storageKey, () => songFromPreset(presets[0]));
  const { song, cursor } = editor;
  const playback = usePlayback(song);
  const [width, setWidth] = useState(0);
  const [sheet, setSheet] = useState<null | 'presets' | 'instrument' | 'add' | { staffId: string }>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    if (!confirmClear) return;
    const timer = setTimeout(() => setConfirmClear(false), 3000);
    return () => clearTimeout(timer);
  }, [confirmClear]);

  const cursorStaff = song.staves.find((s) => s.id === cursor.staffId) ?? song.staves[0];
  const staffSheet = sheet && typeof sheet === 'object' ? song.staves.find((s) => s.id === sheet.staffId) : undefined;

  const loadPreset = (p: Preset) => {
    playback.stop();
    editor.replace(songFromPreset(p));
    setSheet(null);
  };

  const fillAll = (s: Song) => s.staves.reduce((acc, st) => fillRests(acc, st.id), s);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <Header
        title={title}
        subtitle={editing ? subtitle : undefined}
        right={
          <>
            <Chip label="✨" accessibilityLabel={t.examples} onPress={() => setSheet('presets')} />
            <Chip label={`✏️ ${t.edit}`} active={editing} onPress={() => set({ editing: !editing })} />
          </>
        }
      />

      <Transport
        song={song}
        playback={playback}
        onTempo={(tempo) => editor.update((s) => setTempo(s, tempo))}
        onSig={(sig) => editor.edit((s, c) => setTimeSig(s, c, sig))}
        compact={!editing}
      />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll}>
        <Card style={{ paddingHorizontal: 6, paddingBottom: editing ? 12 : 4 }}>
          <View onLayout={(e) => setWidth(Math.floor(e.nativeEvent.layout.width))}>
            {width > 0 && (
              <Score
                song={song}
                cursor={cursor}
                active={playback.active}
                width={width}
                highlightStaff={ensemble && song.staves.length > 1}
                onTapEvent={(staffId, eventId) => editor.setCursor((s, c) => selectEvent(s, c, staffId, eventId))}
                onTapBar={(staffId, bar) => editor.setCursor((s) => cursorToBarEnd(s, staffId, bar))}
                onTapLabel={ensemble ? (staffId) => setSheet({ staffId }) : undefined}
                readOnly={!editing}
              />
            )}
          </View>
          {editing && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.barActions}>
              {!ensemble && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t.chooseInstrument}
                  onPress={() => setSheet('instrument')}
                  style={[styles.instrumentChip, { borderColor: instrument(cursorStaff.instrument).color }]}
                >
                  <Text style={{ fontSize: 18 }}>{instrument(cursorStaff.instrument).emoji}</Text>
                  <Text style={styles.instrumentChipText}>{instrument(cursorStaff.instrument).name[lang]} ▾</Text>
                </Pressable>
              )}
              {ensemble && song.staves.length < MAX_STAVES && (
                <Chip label={`➕ ${t.addInstrument}`} color={colors.accent} active onPress={() => setSheet('add')} />
              )}
              <Chip label={`＋ ${t.addBar}`} onPress={() => editor.edit(addBar)} />
              <Chip label={`－ ${t.removeBar}`} onPress={() => editor.edit((s, c) => removeBar(s, c, c.bar))} />
              <Chip label={t.fillRests} onPress={() => editor.update(fillAll)} />
              <Chip
                label={confirmClear ? `⚠️ ${t.clearConfirm}` : `🗑 ${t.clear}`}
                active={confirmClear}
                color={colors.error}
                onPress={() => {
                  if (confirmClear) {
                    playback.stop();
                    editor.replace(clearSong(song));
                    setConfirmClear(false);
                  } else setConfirmClear(true);
                }}
              />
            </ScrollView>
          )}
        </Card>
        {editing && <Text style={styles.hint}>{ensemble ? t.ensembleHint : t.hint}</Text>}
      </ScrollView>

      {editing && editor.message && (
        <View style={styles.toastWrap} pointerEvents="none">
          <Text style={styles.toast}>{messageText(editor.message, t)}</Text>
        </View>
      )}

      {editing && <Palette editor={editor} />}

      <Sheet visible={sheet === 'presets'} title={t.examples} onClose={() => setSheet(null)} closeLabel={t.close}>
        <View style={{ gap: 10 }}>
          {presets.map((p) => (
            <Pressable
              key={p.id}
              accessibilityRole="button"
              onPress={() => loadPreset(p)}
              style={({ pressed }) => [styles.preset, pressed && { transform: [{ scale: 0.98 }] }]}
            >
              <Text style={styles.presetEmoji}>{p.parts.map((x) => instrument(x.instrument).emoji).join('')}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.presetName}>{p.name[lang]}</Text>
                <Text style={styles.presetMeta}>
                  {p.sig} · {p.tempo} {t.bpm}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      </Sheet>

      <Sheet visible={sheet === 'instrument'} title={t.chooseInstrument} onClose={() => setSheet(null)} closeLabel={t.close}>
        <InstrumentGrid
          current={cursorStaff.instrument}
          onPick={(id) => {
            editor.update((s) => setInstrument(s, cursorStaff.id, id));
            setSheet(null);
          }}
        />
      </Sheet>

      <Sheet visible={sheet === 'add'} title={t.addInstrument} onClose={() => setSheet(null)} closeLabel={t.close}>
        <InstrumentGrid
          onPick={(id) => {
            editor.update((s) => addStaff(s, id));
            setSheet(null);
          }}
        />
      </Sheet>

      <Sheet
        visible={!!staffSheet}
        title={staffSheet ? `${instrument(staffSheet.instrument).emoji} ${instrument(staffSheet.instrument).name[lang]}` : ''}
        onClose={() => setSheet(null)}
        closeLabel={t.close}
      >
        {staffSheet && (
          <View style={{ gap: 14 }}>
            <View style={styles.staffActions}>
              <Chip
                label={staffSheet.muted ? `🔊 ${t.unmute}` : `🔇 ${t.mute}`}
                active={staffSheet.muted}
                color={colors.muted}
                onPress={() => editor.update((s) => toggleMute(s, staffSheet.id))}
              />
              {song.staves.length > 1 && (
                <Chip
                  label={`🗑 ${t.removeInstrument}`}
                  color={colors.error}
                  onPress={() => {
                    editor.update((s) => removeStaff(s, staffSheet.id));
                    setSheet(null);
                  }}
                />
              )}
            </View>
            <Text style={styles.sectionTitle}>{t.chooseInstrument}</Text>
            <InstrumentGrid
              current={staffSheet.instrument}
              onPick={(id) => editor.update((s) => setInstrument(s, staffSheet.id, id))}
            />
          </View>
        )}
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background, gap: 10 },
  scroll: { padding: 16, paddingTop: 2, gap: 10 },
  barActions: { gap: 8, paddingTop: 8, paddingHorizontal: 4 },
  hint: { color: colors.muted, fontSize: 14, fontWeight: '600', textAlign: 'center', paddingHorizontal: 8 },
  toastWrap: { alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 },
  toast: {
    backgroundColor: colors.ink,
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    overflow: 'hidden',
    textAlign: 'center',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  instrument: {
    width: 104,
    height: 92,
    borderRadius: radius.md,
    borderWidth: 3,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  instrumentEmoji: { fontSize: 32 },
  instrumentName: { fontSize: 14, fontWeight: '800', color: colors.ink },
  instrumentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 2,
    borderRadius: 22,
    paddingHorizontal: 10,
    height: 40,
    backgroundColor: colors.surface,
  },
  instrumentChipText: { fontSize: 15, fontWeight: '800', color: colors.ink },
  preset: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  presetEmoji: { fontSize: 24, minWidth: 40 },
  presetName: { fontSize: 18, fontWeight: '900', color: colors.ink },
  presetMeta: { fontSize: 14, fontWeight: '700', color: colors.muted },
  staffActions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: colors.ink },
});
