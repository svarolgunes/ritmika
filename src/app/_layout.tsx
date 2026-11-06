import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors } from '../components/theme';
import { prepareSounds } from '../lib/engine';
import { SettingsProvider } from '../lib/settings';

export default function RootLayout() {
  useEffect(() => {
    prepareSounds();
  }, []);

  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
