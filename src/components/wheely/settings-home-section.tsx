import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { CLIMATE_MESSAGES, describeClimateAdjustment } from '@/domain';
import { useResolvedTempUnit } from '@/hooks/settings-context';
import { useWheelyColors } from '@/hooks/use-theme';
import { Fonts, Type, type WheelyPalette } from '@/constants/theme';
import type { ExposureLevel } from '@/types/settings';
import type { HomeBaseline } from '@/types/weather';
import { GroupedLinkRow, GroupedRow, GroupedSection, useGroupedListStyles } from './grouped-list';
import { RNSegmentedPicker } from './rn-segmented-picker';
import { RNSwitch } from './rn-switch';
import { EXPOSURE_LABELS, EXPOSURE_VALUES } from './settings-form.types';

function makeStyles(c: WheelyPalette) {
  return StyleSheet.create({
    pickerLabel: {
      color: c.mutedInk,
      fontFamily: Fonts.body,
      ...Type.small,
    },
  });
}

/**
 * Home-climate control, laid out like the iOS form's section: the toggle
 * adapts ratings to the rider's home, whose recent climate sets their
 * acclimatization baseline; the Home row names that place and opens search to
 * change it. The footer explains the effect (on) or how to turn it on (off).
 */
export function HomeClimateSection({
  homeLabel,
  activeLabel,
  homeAutoFromSearch,
  canSetHome,
  exposureLevel,
  homeBaseline,
  onSetHome,
  onClearHome,
  onChangeHome,
  onExposureChange,
}: Readonly<{
  homeLabel: string | null;
  activeLabel: string | null;
  homeAutoFromSearch: boolean;
  canSetHome: boolean;
  exposureLevel: ExposureLevel;
  homeBaseline: HomeBaseline | null;
  onSetHome: () => void;
  onClearHome: () => void;
  onChangeHome: () => void;
  onExposureChange: (level: ExposureLevel) => void;
}>) {
  const c = useWheelyColors();
  const styles = makeStyles(c);
  const listStyles = useGroupedListStyles();

  const unit = useResolvedTempUnit();
  // What the setting does, in ride-day temperatures; shared with the iOS form.
  const adjustment = [
    ...describeClimateAdjustment(homeBaseline, exposureLevel, unit, homeLabel),
    ...(homeAutoFromSearch ? [CLIMATE_MESSAGES.AUTO_FROM_SEARCH] : []),
  ].join(' ');
  const footer = homeLabel ? adjustment : CLIMATE_MESSAGES.HINT_OFF(activeLabel);

  return (
    <GroupedSection title="Home climate" footer={footer}>
      <GroupedRow>
        <ThemedText style={listStyles.rowLabel} numberOfLines={2}>
          {CLIMATE_MESSAGES.TOGGLE}
        </ThemedText>
        <RNSwitch
          value={!!homeLabel}
          disabled={!homeLabel && !canSetHome}
          accessibilityLabel={CLIMATE_MESSAGES.TOGGLE}
          onValueChange={(v) => {
            if (v) onSetHome();
            else onClearHome();
          }}
        />
      </GroupedRow>
      {homeLabel ? (
        <GroupedLinkRow
          label={CLIMATE_MESSAGES.LOCATION}
          value={homeLabel}
          accessibilityLabel={`${CLIMATE_MESSAGES.LOCATION}: ${homeLabel}. Change`}
          onPress={onChangeHome}
        />
      ) : null}
      {homeLabel ? (
        <GroupedRow stacked>
          <ThemedText style={styles.pickerLabel}>{CLIMATE_MESSAGES.QUESTION}</ThemedText>
          <RNSegmentedPicker
            values={EXPOSURE_VALUES}
            labels={EXPOSURE_LABELS}
            selectedValue={exposureLevel}
            onSelect={onExposureChange}
          />
        </GroupedRow>
      ) : null}
    </GroupedSection>
  );
}
