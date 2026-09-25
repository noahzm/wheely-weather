import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
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
import { Fonts, Spacing, Type, type WheelyPalette } from '@/constants/theme';
import type { ExposureLevel } from '@/types/settings';
import type { HomeBaseline } from '@/types/weather';
import { selectionFeedback } from '@/utils/haptics';
import { ChevronRight } from './icons';
import { BrutalCard, PressedOpacity, SectionTitle } from './primitives';
import { RNSegmentedPicker } from './rn-segmented-picker';
import { EXPOSURE_LABELS, EXPOSURE_VALUES } from './settings-form.types';

function makeStyles(c: WheelyPalette) {
  return StyleSheet.create({
    group: {
      gap: Spacing.two,
    },
    card: {
      padding: Spacing.four,
      gap: Spacing.three,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.three,
    },
    toggleLabel: {
      flex: 1,
      color: c.ink,
      fontFamily: Fonts.body,
      ...Type.body,
    },
    pickerContainer: {
      gap: Spacing.two,
    },
    pickerLabel: {
      color: c.ink,
      fontFamily: Fonts.heading,
      ...Type.caption,
    },
    exposureHelpText: {
      color: c.mutedInk,
      fontFamily: Fonts.body,
      ...Type.small,
    },
    hint: {
      color: c.mutedInk,
      fontFamily: Fonts.body,
      ...Type.small,
    },
    homeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.two,
    },
    homeRowPressed: {
      opacity: PressedOpacity,
    },
    homeValue: {
      flex: 1,
      color: c.mutedInk,
      fontFamily: Fonts.body,
      ...Type.body,
      textAlign: 'right',
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
    transform: [{ translateX: progress.value * 20 }],
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
        width: 44,
        height: 24,
        borderRadius: 12,
        backgroundColor: value ? c.accent : c.border,
        padding: 2,
        justifyContent: 'center',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Animated.View
        style={[
          {
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: value ? c.accentInk : c.paper,
          },
          thumbStyle,
        ]}
      />
    </Pressable>
  );
}

/**
 * Home-climate control. The toggle adapts ratings to the rider's home, whose
 * recent climate sets their acclimatization baseline; the Home row names that
 * place and opens search to change it. Off, the verdict uses the reference
 * defaults.
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

  const unit = useResolvedTempUnit();
  // What the setting does, in ride-day temperatures; shared with the iOS form.
  const adjustment = [
    ...describeClimateAdjustment(homeBaseline, exposureLevel, unit, homeLabel),
    ...(homeAutoFromSearch ? [CLIMATE_MESSAGES.AUTO_FROM_SEARCH] : []),
  ].join(' ');

  return (
    <View style={styles.group}>
      <SectionTitle title="Home climate" />
      <BrutalCard style={styles.card}>
        <View style={styles.toggleRow}>
          <ThemedText style={styles.toggleLabel} numberOfLines={2}>
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
        </View>

        {!!homeLabel && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${CLIMATE_MESSAGES.LOCATION}: ${homeLabel}. Change`}
            onPress={onChangeHome}
            style={({ pressed }) => [styles.homeRow, pressed && styles.homeRowPressed]}
          >
            <ThemedText style={styles.toggleLabel}>{CLIMATE_MESSAGES.LOCATION}</ThemedText>
            <ThemedText style={styles.homeValue} numberOfLines={1}>
              {homeLabel}
            </ThemedText>
            <ChevronRight size={18} color={c.mutedInk} />
          </Pressable>
        )}

        {!!homeLabel && (
          <View style={styles.pickerContainer}>
            <ThemedText style={styles.pickerLabel}>{CLIMATE_MESSAGES.QUESTION}</ThemedText>
            <RNSegmentedPicker
              values={EXPOSURE_VALUES}
              labels={EXPOSURE_LABELS}
              selectedValue={exposureLevel}
              onSelect={onExposureChange}
            />
            <ThemedText style={styles.exposureHelpText} accessibilityLiveRegion="polite">
              {adjustment}
            </ThemedText>
          </View>
        )}

        {!homeLabel && (
          <ThemedText style={styles.hint}>{CLIMATE_MESSAGES.HINT_OFF(activeLabel)}</ThemedText>
        )}
      </BrutalCard>
    </View>
  );
}
