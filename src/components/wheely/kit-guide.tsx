import { useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { getGearSuggestion } from '@/domain';
import { useWheelyColors } from '@/hooks/use-theme';
import { useGearMode, useResolvedTempUnit } from '@/hooks/settings-context';
import {
  Fonts,
  FontWeightMedium,
  Radius,
  Spacing,
  Type,
  type WheelyPalette,
} from '@/constants/theme';
import type { GearTipItem, RideStatus, Weather } from '@/types/weather';
import { BrutalCard, GameGearIcon } from './primitives';

function makeStyles(c: WheelyPalette) {
  return StyleSheet.create({
    headline: {
      color: c.ink,
      fontFamily: Fonts.heading,
      fontWeight: FontWeightMedium,
      ...Type.body,
    },
    kitGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.two,
    },
    kitTile: {
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.one,
      minHeight: 116,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: Radius.card,
      paddingHorizontal: Spacing.two,
      paddingVertical: Spacing.two,
    },
    kitIconWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      width: 48,
      height: 48,
    },
    textWrap: {
      alignItems: 'center',
      gap: 2,
      width: '100%',
    },
    bodyStrong: {
      color: c.ink,
      fontWeight: '400',
      ...Type.small,
      textAlign: 'center',
      flexShrink: 1,
    },
    muted: {
      color: c.mutedInk,
      ...Type.caption,
      textAlign: 'center',
      flexShrink: 1,
    },
  });
}

function useStyles() {
  const c = useWheelyColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return { c, styles };
}

export function KitGuide({ weather, status }: Readonly<{ weather: Weather; status?: RideStatus }>) {
  const [mode] = useGearMode();
  const tempUnit = useResolvedTempUnit();
  const { width } = useWindowDimensions();
  const gear = getGearSuggestion(weather, mode, status, tempUnit);
  const { c, styles } = useStyles();
  const isWide = width >= 900;
  const tileWidth = isWide ? '31%' : '47%';

  return (
    <BrutalCard>
      {!!gear.headline && <ThemedText style={styles.headline}>{gear.headline}</ThemedText>}
      <View style={styles.kitGrid} accessibilityLiveRegion="polite">
        {gear.items.map((item: GearTipItem, index: number) => {
          return (
            <View key={`${item.label}-${index}`} style={[styles.kitTile, { flexBasis: tileWidth }]}>
              <View style={styles.kitIconWrap}>
                <GameGearIcon iconKey={item.icon} size={42} color={c.mutedInk} />
              </View>
              <View style={styles.textWrap}>
                <ThemedText style={styles.bodyStrong}>{item.label}</ThemedText>
                {!!item.qualifier && <ThemedText style={styles.muted}>{item.qualifier}</ThemedText>}
              </View>
            </View>
          );
        })}
      </View>
    </BrutalCard>
  );
}
