import { Platform } from 'react-native';
import { Stack } from 'expo-router';

import { useForecast } from '@/hooks/forecast-context';
import { useWheelyColors } from '@/hooks/use-theme';
import { Fonts } from '@/constants/theme';

// iOS 26 auto-applies the header blur; pre-26 needs an explicit blur effect on
// the collapsed regular title, and explicitly setting it on 26 hides the large
// title behind the blur. See https://amanhimself.dev/blog/large-header-title-in-expo-router/
function isIOS26OrLater(): boolean {
  if (Platform.OS !== 'ios') return false;
  const version = Platform.Version;
  return (typeof version === 'string' ? Number.parseInt(version, 10) : version) >= 26;
}

export default function HomeTabLayout() {
  const c = useWheelyColors();
  const forecast = useForecast();
  const rawLocation = forecast.snapshot?.location ?? 'Set location';
  const city = rawLocation.split(',')[0]?.trim() ?? 'Set location';

  if (Platform.OS === 'web') {
    return <Stack screenOptions={{ headerShown: false }} />;
  }

  return (
    <Stack
      screenOptions={{
        headerTransparent: Platform.OS === 'ios',
        headerBlurEffect: isIOS26OrLater() ? undefined : 'regular',
        headerTintColor: c.ink,
        headerTitle: city,
        headerTitleStyle: { fontFamily: Fonts.monoBold },
        headerLargeTitleEnabled: true,
        headerLargeTitleStyle: { fontFamily: Fonts.monoBold },
        headerBackTitleStyle: { fontFamily: Fonts.monoBold },
      }}
    >
      <Stack.Screen name="index" />
    </Stack>
  );
}
