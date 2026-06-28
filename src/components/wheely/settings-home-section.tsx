import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useWheelyColors } from '@/hooks/use-theme';
import { Fonts, Spacing, type WheelyPalette } from '@/constants/theme';
import { BrutalCard, HapticPressable, SectionTitle } from './primitives';

function makeStyles(c: WheelyPalette) {
  return StyleSheet.create({
    group: { gap: Spacing.two },
    card: { gap: Spacing.two },
    value: {
      color: c.ink,
      fontFamily: Fonts.sans,
      fontSize: 16,
    },
    hint: {
      color: c.mutedInk,
      fontFamily: Fonts.sans,
      fontSize: 13,
      lineHeight: 18,
    },
    buttons: {
      flexDirection: 'row',
      gap: Spacing.two,
      marginTop: Spacing.one,
    },
    button: {
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 10,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
    },
    buttonPressed: { opacity: 0.5 },
    buttonDisabled: { opacity: 0.35 },
    buttonLabel: {
      color: c.ink,
      fontFamily: Fonts.monoBold,
      fontSize: 13,
      textTransform: 'uppercase',
    },
  });
}

/**
 * Home-climate control: pins the rider's home location, whose recent climate sets
 * their acclimatization baseline. When unset, the verdict uses the reference
 * defaults; when set, hot/humid conditions are judged against what they're used to.
 */
export function HomeClimateSection({
  homeLabel,
  canSetHome,
  onSetHome,
  onClearHome,
}: Readonly<{
  homeLabel: string | null;
  canSetHome: boolean;
  onSetHome: () => void;
  onClearHome: () => void;
}>) {
  const c = useWheelyColors();
  const styles = makeStyles(c);

  return (
    <View style={styles.group}>
      <SectionTitle title="Home climate" />
      <BrutalCard style={styles.card}>
        <ThemedText style={styles.value}>
          {homeLabel ?? 'Not set — using standard thresholds'}
        </ThemedText>
        <ThemedText style={styles.hint}>
          {homeLabel
            ? 'Heat and humidity are judged against what you’re used to at home.'
            : 'Set your home to adapt the verdict to your climate. Other cities adjust relative to home.'}
        </ThemedText>
        <View style={styles.buttons}>
          <HapticPressable
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
              !canSetHome && styles.buttonDisabled,
            ]}
            disabled={!canSetHome}
            onPress={onSetHome}
            accessibilityRole="button"
            accessibilityLabel="Set current location as home"
            accessibilityState={{ disabled: !canSetHome }}
          >
            <ThemedText style={styles.buttonLabel}>Use current</ThemedText>
          </HapticPressable>
          {!!homeLabel && (
            <HapticPressable
              style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
              onPress={onClearHome}
              accessibilityRole="button"
              accessibilityLabel="Clear home location"
            >
              <ThemedText style={styles.buttonLabel}>Clear</ThemedText>
            </HapticPressable>
          )}
        </View>
      </BrutalCard>
    </View>
  );
}
