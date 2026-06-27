import { Text } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GlassView } from 'expo-glass-effect';

import { useWheelyColors } from '@/hooks/use-theme';
import { Fonts, Spacing } from '@/constants/theme';

function SettingsTitle() {
  const c = useWheelyColors();
  return (
    <GlassView
      glassEffectStyle="regular"
      style={{ borderRadius: 22, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two }}
    >
      <Text style={{ fontFamily: Fonts.monoBold, fontSize: 16, color: c.ink }}>Settings</Text>
    </GlassView>
  );
}

export default function SettingsScreen() {
  const c = useWheelyColors();
  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => <SettingsTitle />,
          headerBackTitle: 'Back',
          headerTransparent: true,
          headerTintColor: c.ink,
        }}
      />
      <SafeAreaView style={{ flex: 1 }} edges={['bottom']} />
    </>
  );
}
