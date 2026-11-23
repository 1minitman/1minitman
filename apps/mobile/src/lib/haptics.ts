import type { HapticKind } from '@1minitman/tokens';
import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// The sensory system (Technical Reference 2.5): design tag -> expo-haptics call.
const PLAY: Record<HapticKind, () => Promise<void>> = {
  selection: () => Haptics.selectionAsync(),
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  'double-soft': async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
    await wait(120);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
  },
  warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
};

/**
 * useHaptic('medium') returns a function to call on the interaction.
 * Haptics are never the only feedback, so a failure is ignored.
 * To do with the settings module: respect user_settings.haptics_enabled.
 */
export const useHaptic = (kind: HapticKind) =>
  useCallback(() => {
    PLAY[kind]().catch(() => {});
  }, [kind]);
