import type { ConfigContext, ExpoConfig } from 'expo/config';

// Brand colours (tokens.json): Ink and Paper.
const INK = '#0A0A0A';
const PAPER = '#FFFFFF';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: '1minitman',
  slug: '1minitman',
  owner: 'minitnetwork',
  version: '0.1.0',
  // URL schemes must start with a letter, so the scheme spells the name out.
  scheme: 'oneminitman',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  icon: './assets/images/icon.png',
  // OTA updates only reach builds with the same runtime (Technical Reference 5.1).
  runtimeVersion: { policy: 'appVersion' },
  updates: { url: 'https://u.expo.dev/3763209b-9d3a-4e26-88a4-a219feeaf1e3' },
  ios: {
    supportsTablet: false,
    // bundleIdentifier: set to the id of the existing App Store listing before the first build.
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundColor: INK,
    },
    // package: set to the id of the existing Google Play listing before the first build.
  },
  web: { favicon: './assets/images/favicon.png' },
  plugins: [
    'expo-router',
    'expo-font',
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-mark-ink.png',
        imageWidth: 96,
        backgroundColor: PAPER,
        dark: { image: './assets/images/splash-mark-paper.png', backgroundColor: INK },
      },
    ],
  ],
  experiments: { typedRoutes: true },
  extra: {
    ...config.extra,
    router: {},
    // EAS project @minitnetwork/1minitman (expo.dev). Public identifier, not a secret.
    eas: { projectId: '3763209b-9d3a-4e26-88a4-a219feeaf1e3' },
  },
});
