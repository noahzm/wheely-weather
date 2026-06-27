import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { NationalPark_400Regular, NationalPark_700Bold } from '@expo-google-fonts/national-park';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { TartanBackground } from '@/components/tartan-background';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ForecastProvider } from '@/hooks/forecast-context';

const transparentScreenOptions = {
  contentStyle: { backgroundColor: 'transparent' },
  headerStyle: { backgroundColor: 'transparent' },
} as const;

function navigationTheme(isDark: boolean) {
  const base = isDark ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      background: 'transparent',
      card: 'transparent',
    },
  };
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [fontsLoaded, fontError] = useFonts({
    NationalPark_400Regular,
    NationalPark_700Bold,
  });

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ThemeProvider value={navigationTheme(isDark)}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AnimatedSplashOverlay />
      <ForecastProvider>
        <TartanBackground>
          <Stack screenOptions={transparentScreenOptions}>
            <Stack.Screen name="index" options={{ headerShown: false, title: 'Home' }} />
            <Stack.Screen name="location" options={{ presentation: 'modal' }} />
            <Stack.Screen name="settings" />
          </Stack>
        </TartanBackground>
      </ForecastProvider>
    </ThemeProvider>
  );
}
