import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { hapticTap } from '../lib/feedback';
import { colors, radius, shadow } from './theme';

export function Chip({
  label,
  onPress,
  active,
  color = colors.primary,
  style,
  accessibilityLabel,
  small,
}: {
  small?: boolean;
  label: string;
  onPress: () => void;
  active?: boolean;
  color?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: !!active }}
      onPress={() => {
        hapticTap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.chip,
        small && styles.chipSmall,
        active ? { backgroundColor: color, borderColor: color } : { borderColor: colors.border },
        pressed && styles.pressed,
        style,
      ]}
    >
      <Text style={[styles.chipText, small && styles.chipTextSmall, active && { color: '#fff' }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Sheet({ visible, title, onClose, children, closeLabel }: { visible: boolean; title: string; onClose: () => void; children: ReactNode; closeLabel: string }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={closeLabel}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={closeLabel} onPress={onClose} style={styles.close}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: 8 }}>{children}</ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function Header({ title, subtitle, right }: { title: string; subtitle: string; right?: ReactNode }) {
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text style={styles.logo}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <View style={styles.headerRight}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 2,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontSize: 15, fontWeight: '800', color: colors.ink },
  chipSmall: { minHeight: 34, paddingHorizontal: 10, borderRadius: 17 },
  chipTextSmall: { fontSize: 13 },
  pressed: { transform: [{ scale: 0.95 }] },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 12, ...shadow },
  backdrop: { flex: 1, backgroundColor: 'rgba(43,35,64,0.35)', justifyContent: 'center', padding: 20 },
  sheet: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: 16,
    maxHeight: '85%',
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    ...shadow,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  sheetTitle: { flex: 1, fontSize: 22, fontWeight: '900', color: colors.ink },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 18, fontWeight: '900', color: colors.muted },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4, gap: 8 },
  headerRight: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  logo: { fontSize: 34, fontWeight: '900', color: colors.primary, letterSpacing: 0.5 },
  subtitle: { fontSize: 15, fontWeight: '700', color: colors.muted },
});
