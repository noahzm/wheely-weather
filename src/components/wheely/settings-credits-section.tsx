// Data-source credits for the default (web / Android) settings screen. iOS
// renders its own native Credits section in settings-form.ios.tsx.
import { Linking, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useWheelyColors } from '@/hooks/use-theme';
import { Fonts, Spacing, Type, type WheelyPalette } from '@/constants/theme';
import { SectionTitle } from './primitives';

// Open-Meteo (CC BY 4.0) and OpenStreetMap (ODbL) both require attribution.
const CREDITS = [
  { name: 'Open-Meteo', role: 'forecasts and air quality', url: 'https://open-meteo.com/' },
  {
    name: 'OpenStreetMap contributors',
    role: 'place search',
    url: 'https://www.openstreetmap.org/copyright',
  },
  { name: 'National Weather Service', role: 'US weather alerts', url: 'https://www.weather.gov/' },
] as const;

function makeStyles(c: WheelyPalette) {
  return StyleSheet.create({
    group: {
      gap: Spacing.two,
    },
    line: {
      color: c.mutedInk,
      fontFamily: Fonts.body,
      ...Type.small,
    },
    link: {
      color: c.link,
      textDecorationLine: 'underline',
    },
  });
}

export function CreditsSection() {
  const c = useWheelyColors();
  const styles = makeStyles(c);

  return (
    <View style={styles.group}>
      <SectionTitle title="Credits" />
      {CREDITS.map(({ name, role, url }) => (
        <ThemedText key={name} style={styles.line}>
          <ThemedText
            style={[styles.line, styles.link]}
            accessibilityRole="link"
            onPress={() => {
              Linking.openURL(url).catch(() => {
                /* courtesy link; ignore failures */
              });
            }}
          >
            {name}
          </ThemedText>
          {` · ${role}`}
        </ThemedText>
      ))}
    </View>
  );
}
