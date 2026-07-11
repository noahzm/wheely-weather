import { Platform } from 'react-native';

import { Fonts, FontWeightBold } from '@/constants/theme';
import type { WheelyPalette } from '@/constants/theme';

// iOS 26 auto-applies the header blur; pre-26 needs an explicit blur effect on
// the collapsed regular title, and explicitly setting it on 26 hides the large
// title behind the blur. See https://amanhimself.dev/blog/large-header-title-in-expo-router/
export function isIOS26OrLater(): boolean {
  if (Platform.OS !== 'ios') return false;
  const version = Platform.Version;
  return (typeof version === 'string' ? Number.parseInt(version, 10) : version) >= 26;
}

export function largeTitleStackOptions(c: WheelyPalette, title: string) {
  return {
    headerTransparent: Platform.OS === 'ios',
    headerBlurEffect: isIOS26OrLater() ? undefined : ('regular' as const),
    headerTintColor: c.ink,
    headerTitle: title,
    headerTitleStyle: { fontFamily: Fonts.city },
    headerLargeTitleEnabled: true,
    headerLargeTitleStyle: { fontFamily: Fonts.city },
    headerBackTitleStyle: { fontFamily: Fonts.heading, fontWeight: FontWeightBold },
  };
}
