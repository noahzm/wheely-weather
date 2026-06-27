import { useEffect } from 'react';
import { Platform } from 'react-native';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { NationalPark_400Regular, NationalPark_700Bold } from '@expo-google-fonts/national-park';
import * as SystemUI from 'expo-system-ui';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { TartanBackground } from '@/components/tartan-background';
import { WheelyTheme, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ColorSchemeOverrideContext } from '@/hooks/use-theme';
import { useAppearance } from '@/hooks/use-appearance';
import { ForecastProvider } from '@/hooks/forecast-context';

function navigationTheme(isDark: boolean) {
  const base = isDark ? DarkTheme : DefaultTheme;
  const wheelyBg = WheelyTheme[isDark ? 'dark' : 'light'].background;

  if (Platform.OS === 'web') {
    return {
      ...base,
      colors: {
        ...base.colors,
        background: 'transparent',
        card: 'transparent',
      },
    };
  }

  return {
    ...base,
    colors: {
      ...base.colors,
      background: wheelyBg,
      card: wheelyBg,
    },
  };
}

function stackScreenOptions(isDark: boolean) {
  const wheelyBg = WheelyTheme[isDark ? 'dark' : 'light'].background;

  if (Platform.OS === 'web') {
    return {
      contentStyle: { backgroundColor: 'transparent' as const },
      headerStyle: { backgroundColor: 'transparent' as const },
      headerBackTitleStyle: { fontFamily: Fonts.monoBold },
    };
  }

  return {
    contentStyle: { backgroundColor: wheelyBg },
    headerStyle: { backgroundColor: 'transparent' as const },
    headerBackTitleStyle: { fontFamily: Fonts.monoBold },
  };
}

export default function RootLayout() {
  const systemScheme = useColorScheme();
  const [appearance] = useAppearance();
  // `null` follows the system; an explicit scheme overrides it app-wide.
  const override = appearance === 'system' ? null : appearance;
  const isDark = (override ?? (systemScheme === 'dark' ? 'dark' : 'light')) === 'dark';
  const wheelyBg = WheelyTheme[isDark ? 'dark' : 'light'].background;

  const [fontsLoaded, fontError] = useFonts({
    NationalPark_400Regular,
    NationalPark_700Bold,
  });

  useEffect(() => {
    if (Platform.OS === 'web') return;
    void SystemUI.setBackgroundColorAsync(wheelyBg).catch(() => {
      // Best-effort sync with the native root view background.
    });
  }, [wheelyBg]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  const stack = (
    <Stack screenOptions={stackScreenOptions(isDark)}>
      <Stack.Screen name="index" options={{ headerShown: false, title: 'Home' }} />
      <Stack.Screen name="location" options={{ presentation: 'modal' }} />
      <Stack.Screen name="settings" />
    </Stack>
  );

  return (
    <ColorSchemeOverrideContext.Provider value={override}>
      <ThemeProvider value={navigationTheme(isDark)}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <AnimatedSplashOverlay />
        <ForecastProvider>
          {Platform.OS === 'web' ? <TartanBackground>{stack}</TartanBackground> : stack}
        </ForecastProvider>
      </ThemeProvider>
    </ColorSchemeOverrideContext.Provider>
  );
}
