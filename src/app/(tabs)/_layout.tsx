import { DynamicColorIOS, Platform } from 'react-native';
import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { WheelyTheme } from '@/constants/theme';
import { useWheelyColors } from '@/hooks/use-theme';

export default function TabsLayout() {
  const c = useWheelyColors();
  const tintColor =
    Platform.OS === 'ios'
      ? DynamicColorIOS({ light: WheelyTheme.light.ink, dark: WheelyTheme.dark.ink })
      : c.ink;

  return (
    <NativeTabs
      minimizeBehavior="never"
      sidebarAdaptable
      blurEffect="systemMaterial"
      tintColor={tintColor}
      labelStyle={{ color: tintColor }}
      tabBarRespectsIMEInsets
    >
      <NativeTabs.Trigger name="(home)" disableTransparentOnScrollEdge>
        <NativeTabs.Trigger.Icon sf="house.fill" md="home_filled" />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(location)" role="search">
        <NativeTabs.Trigger.Icon md="search" />
        <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(settings)">
        <NativeTabs.Trigger.Icon sf="gearshape.fill" md="settings" />
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
