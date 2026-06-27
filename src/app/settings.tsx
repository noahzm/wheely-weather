import { Text } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenShell } from '@/components/tartan-background';
import { GlassChrome, SettingsForm } from '@/components/wheely';
import { useGearMode } from '@/hooks/use-gear-mode';
import { useAppearance } from '@/hooks/use-appearance';
import { useWheelyColors } from '@/hooks/use-theme';
import { Fonts, Spacing, TRANSPARENT } from '@/constants/theme';

function SettingsTitle() {
  const c = useWheelyColors();
  return (
    <GlassChrome
      style={{ borderRadius: 22, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two }}
    >
      <Text style={{ fontFamily: Fonts.monoBold, fontSize: 16, color: c.ink }}>Settings</Text>
    </GlassChrome>
  );
}

export default function SettingsScreen() {
  const c = useWheelyColors();
  const [gearMode, setGearMode] = useGearMode();
  const [appearance, setAppearance] = useAppearance();
  const form = (
    <SafeAreaView style={{ flex: 1, backgroundColor: TRANSPARENT }} edges={['bottom']}>
      <SettingsForm
        gearMode={gearMode}
        onGearChange={setGearMode}
        appearance={appearance}
        onAppearanceChange={setAppearance}
      />
    </SafeAreaView>
  );

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
      <ScreenShell>{form}</ScreenShell>
    </>
  );
}
