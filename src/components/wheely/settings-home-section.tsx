// Default (Android / web) home-climate section. iOS is shadowed by
// settings-home-section.ios.tsx with a native SwiftUI Toggle.
import { StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useWheelyColors } from '@/hooks/use-theme';
import { Fonts, Spacing, Type, type WheelyPalette } from '@/constants/theme';
import { selectionFeedback } from '@/utils/haptics';
import { BrutalCard, SectionTitle } from './primitives';

function makeStyles(c: WheelyPalette) {
  return StyleSheet.create({
    group: { gap: Spacing.two },
    card: { gap: Spacing.two },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.two,
    },
    toggleLabel: {
      flex: 1,
      color: c.ink,
      fontFamily: Fonts.body,
      ...Type.body,
    },
    hint: {
      color: c.mutedInk,
      fontFamily: Fonts.body,
      ...Type.small,
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

  const hint = homeLabel
    ? 'Heat and humidity are judged against what you’re used to at home.'
    : 'Set your home to adapt the verdict to your climate. Other cities adjust relative to home.';

  return (
    <View style={styles.group}>
      <SectionTitle title="Home climate" />
      <BrutalCard style={styles.card}>
        <View style={styles.toggleRow}>
          <ThemedText style={styles.toggleLabel} numberOfLines={2}>
            {homeLabel ?? 'Use current location as home'}
          </ThemedText>
          <Switch
            value={!!homeLabel}
            disabled={!homeLabel && !canSetHome}
            trackColor={{ true: c.primary }}
            accessibilityLabel={homeLabel ?? 'Use current location as home'}
            onValueChange={(v) => {
              selectionFeedback();
              if (v) onSetHome();
              else onClearHome();
            }}
          />
        </View>
        <ThemedText style={styles.hint}>{hint}</ThemedText>
      </BrutalCard>
    </View>
  );
}
