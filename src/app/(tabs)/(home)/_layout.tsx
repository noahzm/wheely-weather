import { Platform } from 'react-native';
import { Stack } from 'expo-router';

import { useForecast } from '@/hooks/forecast-context';
import { useWheelyColors } from '@/hooks/use-theme';

import { largeTitleStackOptions } from '@/utils/large-title-stack-options';
import { cityFromLocation } from '@/utils/locationTitle';

export default function HomeTabLayout() {
  const c = useWheelyColors();
  const forecast = useForecast();
  // Plain city only: the native header title is a string, so the "following your
  // device" arrow lives in `CurrentLocationBadge` just below it.
  const title = cityFromLocation(forecast.snapshot?.location) || 'Set location';

  if (Platform.OS === 'web') {
    return <Stack screenOptions={{ headerShown: false }} />;
  }

  return (
    <Stack screenOptions={largeTitleStackOptions(c, title)}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
