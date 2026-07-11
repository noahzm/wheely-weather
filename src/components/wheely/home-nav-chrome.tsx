import { useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useForecast } from '@/hooks/forecast-context';
import { useWheelyColors } from '@/hooks/use-theme';
import { Fonts, FontWeightBold, Spacing } from '@/constants/theme';
import { GlassChrome } from './glass-chrome';
import { HapticPressable, makeButtonStyles } from './primitives';

const NAV_PILL_RADIUS = 22;
const isIos = Platform.OS === 'ios';

function useNavChromeStyles() {
  const c = useWheelyColors();
  return useMemo(() => {
    const button = makeButtonStyles(c);
    return StyleSheet.create({
      locationPillContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: Spacing.three,
        paddingVertical: Spacing.two,
      },
      locationPill: {
        ...button.base,
        ...button.surface,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        borderRadius: NAV_PILL_RADIUS,
        paddingHorizontal: Spacing.three,
        paddingVertical: Spacing.two,
        minHeight: 0,
      },
      locationLabel: {
        fontFamily: Fonts.heading,
        fontWeight: FontWeightBold,
        fontSize: 16,
        color: c.ink,
      },
    });
  }, [c]);
}

export function NavLocationTitle() {
  const forecast = useForecast();
  const router = useRouter();
  const styles = useNavChromeStyles();

  const label = forecast.snapshot?.location ?? 'Set location';

  if (isIos) {
    return (
      <HapticPressable
        onPress={() => {
          router.navigate('/location');
        }}
        accessibilityRole="button"
        accessibilityLabel={`Location: ${label}`}
        style={({ pressed }) => [pressed && { opacity: 0.85 }]}
      >
        <GlassChrome style={{ borderRadius: NAV_PILL_RADIUS }}>
          <View style={styles.locationPillContent}>
            <Text style={styles.locationLabel}>{label}</Text>
          </View>
        </GlassChrome>
      </HapticPressable>
    );
  }

  return (
    <HapticPressable
      onPress={() => {
        router.navigate('/location');
      }}
      accessibilityRole="button"
      accessibilityLabel={`Location: ${label}`}
      style={({ pressed }) => [styles.locationPill, pressed && { opacity: 0.85 }]}
    >
      <Text style={styles.locationLabel} numberOfLines={1}>
        {label}
      </Text>
    </HapticPressable>
  );
}
