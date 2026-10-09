import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { CLIMATE_MESSAGES, describeClimateAdjustment } from '@/domain';
import { useResolvedTempUnit } from '@/hooks/settings-context';
import { useWheelyColors } from '@/hooks/use-theme';
import { Fonts, Radius, Type, WheelyTheme, type WheelyPalette } from '@/constants/theme';
import type { ExposureLevel } from '@/types/settings';
import type { HomeBaseline } from '@/types/weather';
import { withAlpha } from '@/utils/colors';
import { selectionFeedback } from '@/utils/haptics';
import { GroupedLinkRow, GroupedRow, GroupedSection, useGroupedListStyles } from './grouped-list';
import { RNSegmentedPicker } from './rn-segmented-picker';
import { EXPOSURE_LABELS, EXPOSURE_VALUES } from './settings-form.types';

// iOS switch geometry.
const SWITCH_WIDTH = 51;
const SWITCH_HEIGHT = 31;
const SWITCH_PADDING = 2;
const THUMB_SIZE = SWITCH_HEIGHT - SWITCH_PADDING * 2;
// The thumb is white in both schemes, as on iOS; a shadow lifts it off a light track.
const THUMB_COLOR = WheelyTheme.light.paper;
const THUMB_SHADOW = `0 2px 4px ${withAlpha(WheelyTheme.light.shadow, 0.2)}`;

function makeStyles(c: WheelyPalette) {
  return StyleSheet.create({
    pickerLabel: {
      color: c.mutedInk,
      fontFamily: Fonts.body,
      ...Type.small,
    },
  });
}

function RNSwitch({
  value,
  disabled,
  onValueChange,
  accessibilityLabel,
}: Readonly<{
  value: boolean;
  disabled?: boolean;
  onValueChange: (val: boolean) => void;
  accessibilityLabel?: string;
}>) {
  const c = useWheelyColors();
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, {
      duration: 140,
      easing: Easing.out(Easing.quad),
    });
  }, [value, progress]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * (SWITCH_WIDTH - SWITCH_HEIGHT) }],
  }));

  return (
    <Pressable
      onPress={() => {
        if (!disabled) {
          selectionFeedback();
          onValueChange(!value);
        }
      }}
      disabled={disabled}
      hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      style={{
        width: SWITCH_WIDTH,
        height: SWITCH_HEIGHT,
        borderRadius: Radius.pill,
        backgroundColor: value ? c.accent : withAlpha(c.ink, 0.16),
        padding: SWITCH_PADDING,
        justifyContent: 'center',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Animated.View
        style={[
          {
            width: THUMB_SIZE,
            height: THUMB_SIZE,
            borderRadius: Radius.pill,
            backgroundColor: THUMB_COLOR,
            boxShadow: THUMB_SHADOW,
          },
          thumbStyle,
        ]}
      />
    </Pressable>
  );
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
