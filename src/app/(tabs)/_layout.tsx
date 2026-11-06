import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { colors } from '../../components/theme';
import { useSettings } from '../../lib/settings';

export default function TabsLayout() {
  const { t } = useSettings();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontWeight: '700' },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: t.tabSolo, tabBarIcon: ({ color, size }) => <Ionicons name="musical-notes" color={String(color)} size={size} /> }}
      />
      <Tabs.Screen
        name="ensemble"
        options={{ title: t.tabEnsemble, tabBarIcon: ({ color, size }) => <Ionicons name="people" color={String(color)} size={size} /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: t.tabSettings, tabBarIcon: ({ color, size }) => <Ionicons name="settings" color={String(color)} size={size} /> }}
      />
    </Tabs>
  );
}
