import { useEffect, type ReactNode } from 'react';
import { Appearance, Platform, View } from 'react-native';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { NationalPark_400Regular, NationalPark_700Bold } from '@expo-google-fonts/national-park';
import * as SystemUI from 'expo-system-ui';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { TartanBackground } from '@/components/tartan-background';
import { BottomNavBar } from '@/components/wheely';
import { WheelyTheme, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ColorSchemeOverrideContext } from '@/hooks/use-theme';
import { SettingsProvider, useAppearance } from '@/hooks/settings-context';
import { ForecastProvider } from '@/hooks/forecast-context';

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
      headerBackTitleStyle: { fontFamily: Fonts.monoBold },
    };
  }

  return {
    contentStyle: { backgroundColor: palette.background },
    headerStyle: { backgroundColor: 'transparent' as const },
    headerTintColor: palette.ink,
    headerBackTitleStyle: { fontFamily: Fonts.monoBold },
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
      <TartanBackground>
        {stack}
        <View style={bottomNavWrapStyle}>
          <BottomNavBar />
        </View>
      </TartanBackground>
    );
  }

  return <>{stack}</>;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    NationalPark_400Regular,
    NationalPark_700Bold,
  });

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SettingsProvider>
      <ThemedRoot />
    </SettingsProvider>
  );
}

function ThemedRoot() {
  const systemScheme = useColorScheme();
  const [appearance] = useAppearance();
  // `null` follows the system; an explicit scheme overrides it app-wide.
  const override = appearance === 'system' ? null : appearance;
  const isDark = (override ?? (systemScheme === 'dark' ? 'dark' : 'light')) === 'dark';
  const wheelyBg = WheelyTheme[isDark ? 'dark' : 'light'].background;

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
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <AnimatedSplashOverlay />
        <ForecastProvider>{renderRootChrome(stack)}</ForecastProvider>
      </ThemeProvider>
    </ColorSchemeOverrideContext.Provider>
  );
}
