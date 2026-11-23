import { themes, type SemanticColor } from '@1minitman/tokens';
import { vars } from 'nativewind';
import type { ReactNode } from 'react';
import { View, useColorScheme } from 'react-native';

type Scheme = 'light' | 'dark';

// tokens.json is the single source: each theme becomes CSS variables (--bg, --fg, ...)
// that the Tailwind preset's semantic colour classes (bg-bg, text-fg, ...) read.
const toVars = (scheme: Scheme) =>
  vars(
    Object.fromEntries(Object.entries(themes[scheme]).map(([key, value]) => [`--${key}`, value])),
  );

const THEME_VARS: Record<Scheme, ReturnType<typeof vars>> = {
  light: toVars('light'),
  dark: toVars('dark'),
};

/** The device's colour scheme, defaulting to light. */
export const useScheme = (): Scheme => (useColorScheme() === 'dark' ? 'dark' : 'light');

/** A raw colour for APIs that cannot take a class name (navigation bars, icons). */
export const useThemeColor = (name: SemanticColor): string => themes[useScheme()][name];

/** Wrap the app once: everything inside can use the semantic colour classes. */
export const ThemeProvider = ({ children }: { children: ReactNode }) => (
  <View style={[{ flex: 1 }, THEME_VARS[useScheme()]]}>{children}</View>
);
