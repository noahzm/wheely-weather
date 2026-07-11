import { StyleSheet, View } from 'react-native';
import { Host, Switch } from '@expo/ui';

import { ThemedText } from '@/components/themed-text';
import { useWheelyColors } from '@/hooks/use-theme';
import { Fonts, Spacing, type WheelyPalette } from '@/constants/theme';
import { BrutalCard, SectionTitle } from './primitives';

function makeStyles(c: WheelyPalette) {
  return StyleSheet.create({
    group: { gap: Spacing.two },
    card: { gap: Spacing.two },
    hint: {
      color: c.mutedInk,
      fontFamily: Fonts.body,
      fontSize: 13,
      lineHeight: 18,
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
        <Host matchContents>
          <Switch
            value={!!homeLabel}
            disabled={!homeLabel && !canSetHome}
            label={homeLabel ?? 'Use current location as home'}
            onValueChange={(v) => {
              if (v) onSetHome();
              else onClearHome();
            }}
          />
        </Host>
        <ThemedText style={styles.hint}>{hint}</ThemedText>
      </BrutalCard>
    </View>
  );
}
