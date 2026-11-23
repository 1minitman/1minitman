import '../global.css';

import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppProviders } from '@/providers/app-providers';
import { useAppFonts } from '@/providers/fonts';

void SplashScreen.preventAutoHideAsync();

// Root layout. Gates that belong here as they are built: OB1 version gate, ES5 network banner.
export default function RootLayout() {
  const [fontsLoaded, fontError] = useAppFonts();
  const ready = fontsLoaded || Boolean(fontError);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <AppProviders>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }} />
    </AppProviders>
  );
}
