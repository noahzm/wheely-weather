// Web-only settings section pointing visitors to the iOS app. The badge art is
// Apple's official, unaltered artwork (public/app-store-badge-*.svg): the black
// badge on light backgrounds, the white one on dark, per Apple's guidelines.
import { Image, Linking, StyleSheet } from 'react-native';

import { useColorSchemeName } from '@/hooks/use-theme';
import { GroupedRow, GroupedSection } from './grouped-list';
import { HapticPressable } from './primitives';

/** Country-neutral, so each visitor lands in their own storefront. */
export const APP_STORE_URL = 'https://apps.apple.com/app/id6788117343';

// Apple's badge is 119.66 × 40 and must be at least 40 px tall on screen.
const BADGE_HEIGHT = 40;
const BADGE_ASPECT = 119.664_07 / 40;

const styles = StyleSheet.create({
  badge: {
    height: BADGE_HEIGHT,
    aspectRatio: BADGE_ASPECT,
  },
});

export function AppStoreSection() {
  const scheme = useColorSchemeName();
  return (
    <GroupedSection
      title="Get the app"
      footer="The iPhone app adds a Home Screen widget with the verdict and the next 12 hours."
    >
      <GroupedRow>
        <HapticPressable
          accessibilityRole="link"
          accessibilityLabel="Download on the App Store"
          onPress={() => {
            Linking.openURL(APP_STORE_URL).catch(() => {
              /* courtesy link; ignore failures */
            });
          }}
        >
          <Image
            source={{ uri: `/app-store-badge-${scheme === 'dark' ? 'white' : 'black'}.svg` }}
            style={styles.badge}
            accessibilityIgnoresInvertColors
          />
        </HapticPressable>
      </GroupedRow>
    </GroupedSection>
  );
}
