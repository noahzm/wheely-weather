// Default (Android / web) settings body. iOS is shadowed by settings-form.ios.tsx
// with a native SwiftUI Form; here we reuse the cross-platform community
// SegmentedControl inside the app's BrutalCard surfaces.
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
// eslint-disable-next-line import/no-named-as-default
import SegmentedControl from '@expo/ui/community/segmented-control';

import { useColorSchemeName } from '@/hooks/use-theme';
import { Spacing, TRANSPARENT } from '@/constants/theme';
import { selectionFeedback } from '@/utils/haptics';
import { BrutalCard, SectionTitle } from './primitives';
import { WebContentColumn } from './content-column';
import { HomeClimateSection } from './settings-home-section';
import {
  APPEARANCE_LABELS,
  APPEARANCE_VALUES,
  GEAR_LABELS,
  GEAR_MODES,
  TEMP_UNIT_LABELS,
  TEMP_UNIT_VALUES,
  type SettingsFormProps,
} from './settings-form.types';

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    gap: Spacing.four,
  },
  contentWeb: {
    width: '100%',
    alignItems: 'center',
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
  },
  form: {
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
  tempUnit,
  onTempUnitChange,
  homeLabel,
  canSetHome,
  onSetHome,
  onClearHome,
}: Readonly<SettingsFormProps>) {
  const colorScheme = useColorSchemeName();
  const form = (
    <>
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

      <View style={styles.group}>
        <SectionTitle title="Units" />
        <BrutalCard>
          <SegmentedControl
            values={[...TEMP_UNIT_LABELS]}
            selectedIndex={TEMP_UNIT_VALUES.indexOf(tempUnit)}
            appearance={colorScheme}
            onChange={(event) => {
              selectionFeedback();
              const index = event.nativeEvent.selectedSegmentIndex;
              onTempUnitChange(TEMP_UNIT_VALUES[index] ?? 'auto');
            }}
            style={styles.control}
          />
        </BrutalCard>
      </View>

      <HomeClimateSection
        homeLabel={homeLabel}
        canSetHome={canSetHome}
        onSetHome={onSetHome}
        onClearHome={onClearHome}
      />
    </>
  );

  return (
    <ScrollView
      style={{ backgroundColor: TRANSPARENT }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={Platform.OS === 'web' ? styles.contentWeb : styles.content}
    >
      <WebContentColumn innerStyle={styles.form}>{form}</WebContentColumn>
    </ScrollView>
  );
}
