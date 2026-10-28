import { Platform } from 'react-native';

import { Fonts, FontWeightBold, PosterText, Type } from '@/constants/theme';
import type { WheelyPalette } from '@/constants/theme';

// iOS 26 auto-applies the header blur; pre-26 needs an explicit blur effect on
// the collapsed regular title, and explicitly setting it on 26 hides the large
// title behind the blur. See https://amanhimself.dev/blog/large-header-title-in-expo-router/
function isIOS26OrLater(): boolean {
  if (Platform.OS !== 'ios') return false;
  const version = Platform.Version;
  return (typeof version === 'string' ? Number.parseInt(version, 10) : version) >= 26;
}

// Matches PosterText.fontWeight per platform: '700' on iOS so RCTFont picks the
// built-in Oswald-Bold cut over Oswald-Regular in the shared "Oswald" family,
// and '400' elsewhere where useFonts registers Oswald-Bold as a '400' family.
function posterHeaderWeight() {
  return Platform.OS === 'ios' ? FontWeightBold : ('400' as const);
}

/**
 * The expanded large title's style: poster type (Oswald) at the web title's
 * size. `color` overrides the system label color, for a title drawn over the
 * home scene's sky (dark ink in both modes).
 */
export function largeTitleStyle(color?: string) {
  return {
    fontFamily: PosterText.fontFamily,
    fontWeight: posterHeaderWeight(),
    fontSize: Type.subtitle.fontSize,
    ...(color != null && { color }),
  };
}

export function largeTitleStackOptions(c: WheelyPalette, title: string) {
  return {
    headerTransparent: Platform.OS === 'ios',
    headerBlurEffect: isIOS26OrLater() ? undefined : ('regular' as const),
    headerTintColor: c.ink,
    // The native title is a plain string with no text transform, so the
    // poster capitals are applied to the string itself.
    headerTitle: title.toLocaleUpperCase(),
    // Collapsed, the title is poster type at the size of iOS's inline titles.
    headerTitleStyle: {
      fontFamily: PosterText.fontFamily,
      fontWeight: posterHeaderWeight(),
      fontSize: Type.dayTitle.fontSize,
    },
    headerLargeTitleEnabled: true,
    headerLargeTitleStyle: largeTitleStyle(),
    headerBackTitleStyle: { fontFamily: Fonts.heading },
    headerShadowVisible: false,
  };
}
