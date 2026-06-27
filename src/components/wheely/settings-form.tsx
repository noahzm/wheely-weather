// Default (Android / web) settings body. iOS is shadowed by settings-form.ios.tsx
// with a native SwiftUI Form; here we reuse the cross-platform community
// SegmentedControl inside the app's BrutalCard surfaces.
import { ScrollView, StyleSheet, View } from 'react-native';
// eslint-disable-next-line import/no-named-as-default
import SegmentedControl from '@expo/ui/community/segmented-control';

import { useColorSchemeName } from '@/hooks/use-theme';
import { Spacing, TRANSPARENT } from '@/constants/theme';
import { selectionFeedback } from '@/utils/haptics';
import { BrutalCard, SectionTitle } from './primitives';
import {
  APPEARANCE_LABELS,
  APPEARANCE_VALUES,
  GEAR_LABELS,
  GEAR_MODES,
  type SettingsFormProps,
} from './settings-form.types';

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    gap: Spacing.four,
  },
  group: {
    gap: Spacing.two,
  },
  control: {
    alignSelf: 'stretch',
  },
});

export function SettingsForm({
  gearMode,
  onGearChange,
  appearance,
  onAppearanceChange,
}: Readonly<SettingsFormProps>) {
  const colorScheme = useColorSchemeName();
  return (
    <ScrollView
      style={{ backgroundColor: TRANSPARENT }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
    >
      <View style={styles.group}>
        <SectionTitle title="Gear" />
        <BrutalCard>
          <SegmentedControl
            values={[...GEAR_LABELS]}
            selectedIndex={GEAR_MODES.indexOf(gearMode)}
            appearance={colorScheme}
            onChange={(event) => {
              selectionFeedback();
              const index = event.nativeEvent.selectedSegmentIndex;
              onGearChange(GEAR_MODES[index] ?? 'casual');
            }}
            style={styles.control}
          />
        </BrutalCard>
      </View>

      <View style={styles.group}>
        <SectionTitle title="Appearance" />
        <BrutalCard>
          <SegmentedControl
            values={[...APPEARANCE_LABELS]}
            selectedIndex={APPEARANCE_VALUES.indexOf(appearance)}
            appearance={colorScheme}
            onChange={(event) => {
              selectionFeedback();
              const index = event.nativeEvent.selectedSegmentIndex;
              onAppearanceChange(APPEARANCE_VALUES[index] ?? 'system');
            }}
            style={styles.control}
          />
        </BrutalCard>
      </View>
    </ScrollView>
  );
}
