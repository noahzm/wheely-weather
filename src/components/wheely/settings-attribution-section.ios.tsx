import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import AppleWeatherKitModule from '../../../modules/apple-weatherkit/src/AppleWeatherKitModule';
import type { WeatherKitAttribution } from '../../../modules/apple-weatherkit/src/AppleWeatherKit.types';
import { ThemedText } from '@/components/themed-text';
import { ExternalLink } from '@/components/external-link';
import { useColorSchemeName, useWheelyColors } from '@/hooks/use-theme';
import { Fonts, Spacing, type WheelyPalette } from '@/constants/theme';
import { BrutalCard, HapticPressable, SectionTitle } from './primitives';

function makeStyles(c: WheelyPalette) {
  return StyleSheet.create({
    group: { gap: Spacing.two },
    card: { gap: Spacing.two, alignItems: 'center' },
    logo: {
      height: 22,
      width: 160,
    },
    hint: {
      color: c.mutedInk,
      fontFamily: Fonts.sans,
      fontSize: 13,
      lineHeight: 18,
      textAlign: 'center',
    },
  });
}

/**
 * Apple's required WeatherKit attribution: a "Weather" mark linking to the
 * legal attribution page. Renders nothing until the native call resolves —
 * this is a credits section, not a functional path, so failures (unlinked
 * module, network error) fail silently rather than showing an error state.
 */
export function WeatherAttributionSection() {
  const c = useWheelyColors();
  const styles = makeStyles(c);
  const scheme = useColorSchemeName();
  const [attribution, setAttribution] = useState<WeatherKitAttribution | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!AppleWeatherKitModule) return;
    AppleWeatherKitModule.attribution()
      .then((result) => {
        if (!cancelled) setAttribution(result);
      })
      .catch(() => {
        /* credits-only section; ignore failures */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!attribution) return null;

  const logoUrl = scheme === 'dark' ? attribution.logoDarkURL : attribution.logoLightURL;

  return (
    <View style={styles.group}>
      <SectionTitle title="Weather data" />
      <BrutalCard small style={styles.card}>
        <ExternalLink href={attribution.legalPageURL as `${string}:${string}`} asChild>
          <HapticPressable
            hitSlop={12}
            accessibilityRole="link"
            accessibilityLabel="Apple Weather attribution, opens the legal attribution page"
          >
            <Image
              source={{ uri: logoUrl }}
              style={styles.logo}
              contentFit="contain"
              accessible={false}
            />
          </HapticPressable>
        </ExternalLink>
        <ThemedText style={styles.hint}>
          Apple Weather provides forecasts and severe weather alerts on iOS.
        </ThemedText>
      </BrutalCard>
    </View>
  );
}
