import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { MapPin } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { deriveAcclimatization } from '@/domain/acclimatization';
import { useWheelyColors } from '@/hooks/use-theme';
import { Fonts, Spacing, Type, type WheelyPalette } from '@/constants/theme';
import type { ExposureLevel } from '@/types/settings';
import type { HomeBaseline } from '@/types/weather';
import { selectionFeedback } from '@/utils/haptics';
import { BrutalCard, PlatformIcon, SectionTitle } from './primitives';
import { RNSegmentedPicker } from './rn-segmented-picker';
import { EXPOSURE_LABELS, EXPOSURE_VALUES } from './settings-form.types';

const EXPOSURE_HELP: Record<ExposureLevel, string> = {
  indoor: 'Indoor / AC: Standard thresholds applied (0° shift).',
  moderate: 'Moderate (~1h/day): Partial climate shift applied.',
  high: 'High (2h+/day): Full climate shift applied.',
};

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
    badgeCard: {
      backgroundColor: c.background,
      borderColor: c.border,
      borderWidth: 1,
      borderRadius: 8,
      padding: Spacing.three,
    },
    badgeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.one,
    },
    badgeTitle: {
      color: c.ink,
      fontFamily: Fonts.heading,
      ...Type.caption,
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
 * Home-climate control: pins the rider's home location, whose recent climate sets
 * their acclimatization baseline. When unset, the verdict uses the reference
 * defaults; when set, hot/humid conditions are judged against what they're used to.
 */
export function HomeClimateSection({
  homeLabel,
  canSetHome,
  exposureLevel,
  homeBaseline,
  onSetHome,
  onClearHome,
  onExposureChange,
}: Readonly<{
  homeLabel: string | null;
  canSetHome: boolean;
  exposureLevel: ExposureLevel;
  homeBaseline: HomeBaseline | null;
  onSetHome: () => void;
  onClearHome: () => void;
  onExposureChange: (level: ExposureLevel) => void;
}>) {
  const c = useWheelyColors();
  const styles = makeStyles(c);

  const acclimatization = deriveAcclimatization(homeBaseline, exposureLevel);
  const tempShift = acclimatization.tempShift;

  const hint = homeLabel
    ? 'Adapts heat and humidity thresholds to your home climate.'
    : 'Set your home location to adapt heat & humidity thresholds to your climate.';

  return (
    <View style={styles.group}>
      <SectionTitle title="Home climate" />
      <BrutalCard style={styles.card}>
        <View style={styles.toggleRow}>
          <ThemedText style={styles.toggleLabel} numberOfLines={2}>
            {homeLabel ?? 'Use current location as home'}
          </ThemedText>
          <RNSwitch
            value={!!homeLabel}
            disabled={!homeLabel && !canSetHome}
            accessibilityLabel={homeLabel ?? 'Use current location as home'}
            onValueChange={(v) => {
              if (v) onSetHome();
              else onClearHome();
            }}
          />
        </View>

        {!!homeLabel && (
          <>
            <View style={styles.pickerContainer}>
              <ThemedText style={styles.pickerLabel}>Daily Outdoor Exposure</ThemedText>
              <RNSegmentedPicker
                values={EXPOSURE_VALUES}
                labels={EXPOSURE_LABELS}
                selectedValue={exposureLevel}
                onSelect={onExposureChange}
              />
              <ThemedText style={styles.exposureHelpText}>
                {EXPOSURE_HELP[exposureLevel]}
              </ThemedText>
            </View>

            {homeBaseline != null && (
              <View style={styles.badgeCard}>
                <View style={styles.badgeHeader}>
                  <PlatformIcon icon={MapPin} size={14} color={c.ink} strokeWidth={2.5} />
                  <ThemedText style={styles.badgeTitle}>
                    Climate Baseline: {Math.round(homeBaseline.warmTemp)}°F max •{' '}
                    {Math.round(homeBaseline.warmDewpoint)}°F dew (
                    {tempShift > 0 ? `+${tempShift}°F shift` : 'no shift'})
                  </ThemedText>
                </View>
              </View>
            )}
          </>
        )}

        <ThemedText style={styles.hint}>{hint}</ThemedText>
      </BrutalCard>
    </View>
  );
}
