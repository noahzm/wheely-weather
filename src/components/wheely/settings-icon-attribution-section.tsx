import { StyleSheet, View } from 'react-native';

import { ExternalLink } from '@/components/external-link';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing, type WheelyPalette } from '@/constants/theme';
import { useWheelyColors } from '@/hooks/use-theme';
import { BrutalCard, HapticPressable, SectionTitle } from './primitives';

function makeStyles(c: WheelyPalette) {
  return StyleSheet.create({
    group: { gap: Spacing.two },
    card: { gap: Spacing.two },
    link: {
      color: c.ink,
      fontFamily: Fonts.body,
      fontSize: 14,
      lineHeight: 20,
      textDecorationLine: 'underline',
    },
    hint: {
      color: c.mutedInk,
      fontFamily: Fonts.body,
      fontSize: 13,
      lineHeight: 18,
    },
  });
}

export function IconAttributionSection() {
  const c = useWheelyColors();
  const styles = makeStyles(c);

  return (
    <View style={styles.group}>
      <SectionTitle title="Icon credits" />
      <BrutalCard small style={styles.card}>
        <ExternalLink href="https://game-icons.net/" asChild>
          <HapticPressable accessibilityRole="link" accessibilityLabel="Open game-icons website">
            <ThemedText style={styles.link}>Kit guide icons by game-icons.net</ThemedText>
          </HapticPressable>
        </ExternalLink>
        <ThemedText style={styles.hint}>
          Game-icons artwork by Lorc and Delapouite, licensed under CC BY 3.0.
        </ThemedText>
      </BrutalCard>
    </View>
  );
}
