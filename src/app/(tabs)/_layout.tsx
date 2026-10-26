import { DynamicColorIOS, Platform } from 'react-native';
import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { WheelyTheme, Fonts, FontWeightSemibold } from '@/constants/theme';
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
      labelStyle={{ color: tintColor, fontFamily: Fonts.bold, fontWeight: FontWeightSemibold }}
      tabBarRespectsIMEInsets
    >
      {/* Home scrolls itself to the top on a repeat tap (`useLargeTitleScrollToTop`):
          the built-in scroll stops at the collapsed title's edge and leaves it collapsed. */}
      <NativeTabs.Trigger name="(home)" disableTransparentOnScrollEdge disableScrollToTop>
        <NativeTabs.Trigger.Icon sf="cloud.sun.fill" md="partly_cloudy_day" />
        <NativeTabs.Trigger.Label>Weather</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      {/* No automatic activation: with it, cancelling search (the field's X) jumps
          back to the previous tab, so the keyboard couldn't be put away to reach
          results under it. `prominent` keeps the detached placement on iOS 27,
          which UIKit otherwise gives the search tab only while activation is on. */}
      <NativeTabs.Trigger name="location" role="search" disableAutomaticSearchActivation prominent>
        <NativeTabs.Trigger.Icon md="search" />
        <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon sf="gearshape.fill" md="settings" />
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
