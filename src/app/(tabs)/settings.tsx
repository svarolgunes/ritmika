import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../../components/theme';
import { Card, Chip, Header } from '../../components/ui';
import { playSound } from '../../lib/engine';
import { useSettings } from '../../lib/settings';

const LEVELS = [
  { key: 'low', value: 0.35 },
  { key: 'medium', value: 0.7 },
  { key: 'high', value: 1 },
] as const;

export default function SettingsScreen() {
  const settings = useSettings();
  const { t } = settings;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <Header title={t.settingsTitle} subtitle={t.appName} />
      <ScrollView contentContainerStyle={styles.list}>
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>{t.language}</Text>
          <View style={styles.row}>
            <Chip label="Türkçe" active={settings.lang === 'tr'} onPress={() => settings.set({ lang: 'tr' })} />
            <Chip label="English" active={settings.lang === 'en'} onPress={() => settings.set({ lang: 'en' })} />
          </View>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>{t.clickVolume}</Text>
          <View style={styles.row}>
            {LEVELS.map((l) => (
              <Chip
                key={l.key}
                label={t[l.key]}
                active={settings.clickVolume === l.value}
                onPress={() => {
                  settings.set({ clickVolume: l.value });
                  playSound('click-accent', l.value);
                }}
              />
            ))}
          </View>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>{t.noteVolume}</Text>
          <View style={styles.row}>
            {LEVELS.map((l) => (
              <Chip
                key={l.key}
                label={t[l.key]}
                active={settings.noteVolume === l.value}
                onPress={() => {
                  settings.set({ noteVolume: l.value });
                  playSound('woodblock', l.value);
                }}
              />
            ))}
          </View>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>{t.howTo}</Text>
          {t.howToItems.map((item) => (
            <View key={item} style={styles.bulletRow}>
              <Text style={styles.bullet}>♪</Text>
              <Text style={styles.bulletText}>{item}</Text>
            </View>
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  list: { padding: 16, gap: 14, maxWidth: 640, width: '100%', alignSelf: 'center' },
  card: { padding: 16, gap: 12 },
  cardTitle: { fontSize: 18, fontWeight: '900', color: colors.ink },
  row: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  bulletRow: { flexDirection: 'row', gap: 10 },
  bullet: { fontSize: 16, color: colors.primary, fontWeight: '900' },
  bulletText: { flex: 1, fontSize: 15, color: colors.ink, lineHeight: 22 },
});
