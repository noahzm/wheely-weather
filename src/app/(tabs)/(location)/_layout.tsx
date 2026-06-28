import { Platform } from 'react-native';
import { Stack } from 'expo-router';

import { useWheelyColors } from '@/hooks/use-theme';
import { Fonts } from '@/constants/theme';

function isIOS26OrLater(): boolean {
  if (Platform.OS !== 'ios') return false;
  const version = Platform.Version;
  return (typeof version === 'string' ? Number.parseInt(version, 10) : version) >= 26;
}

export default function LocationTabLayout() {
  const c = useWheelyColors();

  if (Platform.OS === 'web') {
    return <Stack screenOptions={{ headerShown: false }} />;
  }

  return (
    <Stack
      screenOptions={{
        headerTransparent: Platform.OS === 'ios',
        headerBlurEffect: isIOS26OrLater() ? undefined : 'regular',
        headerTintColor: c.ink,
        headerTitle: 'Search',
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
