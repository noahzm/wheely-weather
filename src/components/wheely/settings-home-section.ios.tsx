import { StyleSheet, View } from 'react-native';
import { Host, Text, Toggle } from '@expo/ui/swift-ui';
import { disabled, foregroundStyle, tint } from '@expo/ui/swift-ui/modifiers';

import { useWheelyColors } from '@/hooks/use-theme';
import { Spacing, TRANSPARENT } from '@/constants/theme';
import { BrutalCard, SectionTitle } from './primitives';

// Intrinsic height of a SwiftUI Toggle row with a two-line label (title +
// subtitle); the Host needs an explicit size since it can't measure SwiftUI
// content intrinsally. Tuned to fit two lines of body text comfortably.
const TOGGLE_HEIGHT = 64;

const styles = StyleSheet.create({
  group: { gap: Spacing.two },
  host: {
    height: TOGGLE_HEIGHT,
    backgroundColor: TRANSPARENT,
  },
});

/**
 * iOS home-climate control — a native SwiftUI Toggle. ON pins the current
 * active location as the rider's home (the acclimatization baseline); OFF
 * clears it. Disabled when no active location can be saved. The two `Text`
 * children form the toggle's title + subtitle (SwiftUI convention).
 */
export function HomeClimateSection({
  homeLabel,
  canSetHome,
  onSetHome,
  onClearHome,
}: Readonly<{
  homeLabel: string | null;
  canSetHome: boolean;
  onSetHome: () => void;
  onClearHome: () => void;
}>) {
  const c = useWheelyColors();
  const isOn = !!homeLabel;
  const title = homeLabel ?? 'Use current location as home';
  const subtitle = homeLabel
    ? 'Heat and humidity are judged against what you’re used to at home.'
    : 'Set your home to adapt the verdict to your climate. Other cities adjust relative to home.';

  return (
    <View style={styles.group}>
      <SectionTitle title="Home climate" />
      <BrutalCard>
        <Host style={styles.host}>
          <Toggle
            isOn={isOn}
            onIsOnChange={(value: boolean) => {
              if (value && canSetHome && !isOn) onSetHome();
              else if (!value && isOn) onClearHome();
            }}
            modifiers={[disabled(!isOn && !canSetHome), tint(c.primary)]}
          >
            <Text>{title}</Text>
            <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
              {subtitle}
            </Text>
          </Toggle>
        </Host>
      </BrutalCard>
    </View>
  );
}
