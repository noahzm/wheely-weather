import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing, Type, type WheelyPalette } from '@/constants/theme';
import { useWheelyColors } from '@/hooks/use-theme';
import { GEAR_LABELS, GEAR_MODES, type GearMode } from '@/types/settings';
import { HapticPressable } from './primitives';

function makeStyles(c: WheelyPalette) {
  return StyleSheet.create({
    stylePicker: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: Radius.pill,
      padding: 2,
      backgroundColor: c.paper,
      gap: 2,
    },
    stylePill: {
      paddingHorizontal: Spacing.two,
      paddingVertical: 3,
      borderRadius: Radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stylePillActive: {
      backgroundColor: c.primary,
    },
    stylePillText: {
      color: c.ink,
      fontFamily: Fonts.body,
      fontSize: Type.micro.fontSize,
      fontWeight: '600',
    },
    stylePillTextActive: {
      color: c.primaryInk,
    },
  });
}

export function GearStylePicker({
  mode,
  onModeChange,
}: Readonly<{
  mode: GearMode;
  onModeChange: (mode: GearMode) => void;
}>) {
  const c = useWheelyColors();
  const styles = makeStyles(c);

  return (
    <View
      style={styles.stylePicker}
      accessibilityRole="radiogroup"
      accessibilityLabel="Rider style"
    >
      {GEAR_MODES.map((modeKey, index) => {
        const active = mode === modeKey;
        return (
          <HapticPressable
            key={modeKey}
            onPress={() => {
              onModeChange(modeKey);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Ride style: ${GEAR_LABELS[index]}`}
            style={[styles.stylePill, active && styles.stylePillActive]}
          >
            <ThemedText style={[styles.stylePillText, active && styles.stylePillTextActive]}>
              {GEAR_LABELS[index]}
            </ThemedText>
          </HapticPressable>
        );
      })}
    </View>
  );
}
