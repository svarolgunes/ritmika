import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export function hapticTap() {
  if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
}

export function hapticError() {
  if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}
