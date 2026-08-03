// Default (Android / web) settings body. iOS is shadowed by settings-form.ios.tsx
// with a native SwiftUI Form; here we reuse the cross-platform community
// SegmentedControl inside the app's BrutalCard surfaces.
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing, TRANSPARENT } from '@/constants/theme';
import { SectionTitle } from './primitives';
import { WebContentColumn } from './content-column';
import { webBottomInset } from './bottom-nav-chrome';
import { WEB_TITLE_CONTENT_SPACING } from './web-screen-header';
import { HomeClimateSection } from './settings-home-section';
import { IconAttributionSection } from './settings-icon-attribution-section';
import { RNSegmentedPicker } from './rn-segmented-picker';
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
    paddingTop: WEB_TITLE_CONTENT_SPACING,
  },
  form: {
    gap: Spacing.four,
  },
  group: {
    gap: Spacing.three,
  },
});

export function SettingsForm({
  gearMode,
  onGearChange,
  appearance,
  onAppearanceChange,
  tempUnit,
  onTempUnitChange,
  exposureLevel,
  onExposureChange,
  homeBaseline,
  homeLabel,
  canSetHome,
  onSetHome,
  onClearHome,
}: Readonly<SettingsFormProps>) {
  const insets = useSafeAreaInsets();
  const form = (
    <>
      <View style={styles.group}>
        <SectionTitle title="Ride style" />
        <RNSegmentedPicker
          values={GEAR_MODES}
          labels={GEAR_LABELS}
          selectedValue={gearMode}
          onSelect={onGearChange}
        />
      </View>

      <View style={styles.group}>
        <SectionTitle title="Appearance" />
        <RNSegmentedPicker
          values={APPEARANCE_VALUES}
          labels={APPEARANCE_LABELS}
          selectedValue={appearance}
          onSelect={onAppearanceChange}
        />
      </View>

      <View style={styles.group}>
        <SectionTitle title="Units" />
        <RNSegmentedPicker
          values={TEMP_UNIT_VALUES}
          labels={TEMP_UNIT_LABELS}
          selectedValue={tempUnit}
          onSelect={onTempUnitChange}
        />
      </View>

      <HomeClimateSection
        homeLabel={homeLabel}
        canSetHome={canSetHome}
        exposureLevel={exposureLevel}
        homeBaseline={homeBaseline}
        onSetHome={onSetHome}
        onClearHome={onClearHome}
        onExposureChange={onExposureChange}
      />

      <IconAttributionSection />
    </>
  );

  return (
    <ScrollView
      style={{ backgroundColor: TRANSPARENT }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={
        Platform.OS === 'web'
          ? [styles.contentWeb, { paddingBottom: webBottomInset(insets.bottom) }]
          : styles.content
      }
    >
      <WebContentColumn innerStyle={styles.form}>{form}</WebContentColumn>
    </ScrollView>
  );
}
