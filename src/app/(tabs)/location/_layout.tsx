import { Platform } from 'react-native';
import { Slot, Stack } from 'expo-router';

import { useWheelyColors } from '@/hooks/use-theme';

import { largeTitleStackOptions } from '@/utils/large-title-stack-options';

export default function LocationTabLayout() {
  const c = useWheelyColors();

  // Web: no stack, so the screen sits in the document flow and the page
  // itself scrolls (Safari's toolbar collapse, pull to refresh).
  if (Platform.OS === 'web') {
    return <Slot />;
  }

  return (
    <Stack screenOptions={largeTitleStackOptions(c, 'Search')}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
