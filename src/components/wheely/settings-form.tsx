// Default (Android / web) settings body. iOS is shadowed by settings-form.ios.tsx
// with a native SwiftUI inset-grouped List; this mirrors its sections with the
// grouped-list pieces.
import { Platform, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing, TRANSPARENT } from '@/constants/theme';
import { GroupedRow, GroupedSection } from './grouped-list';
import { WebContentColumn } from './content-column';
import { webBottomInset } from './bottom-nav-chrome';
import { HomeClimateSection } from './settings-home-section';
import { CreditsSection } from './settings-credits-section';
import { RNSegmentedPicker } from './rn-segmented-picker';
import {
  APPEARANCE_LABELS,
  APPEARANCE_VALUES,
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
  },
  form: {
    gap: Spacing.five,
  },
});

export function SettingsForm({
  appearance,
  onAppearanceChange,
  tempUnit,
  onTempUnitChange,
  exposureLevel,
  onExposureChange,
  homeBaseline,
  homeLabel,
  activeLabel,
  homeAutoFromSearch,
  canSetHome,
  onSetHome,
  onClearHome,
  onChangeHome,
  webHeader,
  onScroll,
}: Readonly<SettingsFormProps>) {
  const insets = useSafeAreaInsets();
  const form = (
    <>
      <GroupedSection title="Appearance">
        <GroupedRow stacked>
          <RNSegmentedPicker
            values={APPEARANCE_VALUES}
            labels={APPEARANCE_LABELS}
            selectedValue={appearance}
            onSelect={onAppearanceChange}
          />
        </GroupedRow>
      </GroupedSection>

      <GroupedSection title="Units">
        <GroupedRow stacked>
          <RNSegmentedPicker
            values={TEMP_UNIT_VALUES}
            labels={TEMP_UNIT_LABELS}
            selectedValue={tempUnit}
            onSelect={onTempUnitChange}
          />
        </GroupedRow>
      </GroupedSection>

      <HomeClimateSection
        homeLabel={homeLabel}
        activeLabel={activeLabel}
        homeAutoFromSearch={homeAutoFromSearch}
        onChangeHome={onChangeHome}
        canSetHome={canSetHome}
        exposureLevel={exposureLevel}
        homeBaseline={homeBaseline}
        onSetHome={onSetHome}
        onClearHome={onClearHome}
        onExposureChange={onExposureChange}
      />

      <CreditsSection />
    </>
  );

  return (
    <ScrollView
      style={{ backgroundColor: TRANSPARENT }}
      contentInsetAdjustmentBehavior="automatic"
      onScroll={onScroll}
      scrollEventThrottle={16}
      contentContainerStyle={
        Platform.OS === 'web'
          ? [styles.contentWeb, { paddingBottom: webBottomInset(insets.bottom) }]
          : styles.content
      }
    >
      <WebContentColumn innerStyle={styles.form}>
        {webHeader}
        {form}
      </WebContentColumn>
    </ScrollView>
  );
}
