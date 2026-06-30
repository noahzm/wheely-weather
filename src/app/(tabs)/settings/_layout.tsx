import { Platform } from 'react-native';
import { Stack } from 'expo-router';

import { useWheelyColors } from '@/hooks/use-theme';

import { largeTitleStackOptions } from '@/utils/large-title-stack-options';

export default function SettingsTabLayout() {
  const c = useWheelyColors();

  if (Platform.OS === 'web') {
    return <Stack screenOptions={{ headerShown: false }} />;
  }

  return (
    <Stack screenOptions={largeTitleStackOptions(c, 'Settings')}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
