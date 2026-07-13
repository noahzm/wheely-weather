import { useEffect, type ReactNode } from 'react';
import { Appearance, Platform, View } from 'react-native';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import Head from 'expo-router/head';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import * as Sentry from '@sentry/react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { BottomNavBar } from '@/components/wheely';
import { WheelyTheme, Fonts, FontWeightBold } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ColorSchemeOverrideContext } from '@/hooks/use-theme';
import { SettingsProvider, useAppearance } from '@/hooks/settings-context';
import { ForecastProvider } from '@/hooks/forecast-context';
import { useWebDocumentTheme } from '@/hooks/use-web-document-theme';
import { initSentry, sentryEnabled } from '@/services/telemetry';

// Runs once at module load, before the first render — a no-op until
// EXPO_PUBLIC_SENTRY_DSN is configured (see .env.example).
initSentry();

function navigationTheme(isDark: boolean) {
  const base = isDark ? DarkTheme : DefaultTheme;
  const palette = WheelyTheme[isDark ? 'dark' : 'light'];

  if (Platform.OS === 'web') {
    return {
      ...base,
      colors: {
        ...base.colors,
        background: 'transparent',
        card: 'transparent',
        primary: palette.ink,
      },
    };
  }

  return {
    ...base,
    colors: {
      ...base.colors,
      background: palette.background,
      card: palette.background,
      primary: palette.ink,
    },
  };
}

function stackScreenOptions(isDark: boolean) {
  const palette = WheelyTheme[isDark ? 'dark' : 'light'];

  if (Platform.OS === 'web') {
    return {
      contentStyle: { backgroundColor: 'transparent' as const },
      headerStyle: { backgroundColor: 'transparent' as const },
      headerTintColor: palette.ink,
      headerBackTitleStyle: { fontFamily: Fonts.heading, fontWeight: FontWeightBold },
    };
  }

  return {
    contentStyle: { backgroundColor: palette.background },
    headerStyle: { backgroundColor: 'transparent' as const },
    headerTintColor: palette.ink,
    headerBackTitleStyle: { fontFamily: Fonts.heading, fontWeight: FontWeightBold },
  };
}

function renderRootChrome(stack: ReactNode): ReactNode {
  const bottomNavWrapStyle = {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  };

  if (Platform.OS === 'web') {
    return (
      <View style={{ flex: 1 }}>
        {stack}
        <View style={bottomNavWrapStyle}>
          <BottomNavBar />
        </View>
      </View>
    );
  }

  return <>{stack}</>;
}

function RootLayout() {
  return (
    <SettingsProvider>
      <ThemedRoot />
    </SettingsProvider>
  );
}

// Skip wrapping entirely when Sentry is disabled (no DSN) — wrapping without
// an initialized client leaves the app-start profiler with nothing to report
// to, which logs a spurious "Sentry.wrap was called before Sentry.init"
// warning on every local dev launch.
export default sentryEnabled ? Sentry.wrap(RootLayout) : RootLayout;

function ThemedRoot() {
  const systemScheme = useColorScheme();
  const [appearance] = useAppearance();
  // `null` follows the system; an explicit scheme overrides it app-wide.
  const override = appearance === 'system' ? null : appearance;
  const isDark = (override ?? (systemScheme === 'dark' ? 'dark' : 'light')) === 'dark';
  const wheelyBg = WheelyTheme[isDark ? 'dark' : 'light'].background;

  useWebDocumentTheme(isDark);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    void SystemUI.setBackgroundColorAsync(wheelyBg).catch(() => {
      // Best-effort sync with the native root view background.
    });
  }, [wheelyBg]);

  // Drive the native UIKit trait too, not just the JS palette. Native surfaces
  // (the nav bar blur, expo-glass-effect, SwiftUI segmented pickers) follow the
  // window's userInterfaceStyle — without this, forcing an in-app appearance
  // only repaints JS-drawn colors and leaves those native views stale.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    Appearance.setColorScheme(override ?? 'unspecified');
  }, [override]);

  const stack = (
    <Stack screenOptions={stackScreenOptions(isDark)}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );

  return (
    <ColorSchemeOverrideContext.Provider value={override}>
      <ThemeProvider value={navigationTheme(isDark)}>
        <Head>
          <title>Wheely Weather — Ride forecast for cyclists</title>
          <meta
            name="description"
            content="Scores how good today's weather is for a bike ride — hourly forecast, kit guide, and a plain-language ride verdict."
          />
        </Head>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <AnimatedSplashOverlay />
        <ForecastProvider>{renderRootChrome(stack)}</ForecastProvider>
      </ThemeProvider>
    </ColorSchemeOverrideContext.Provider>
  );
}
