import { useMemo, useState } from 'react';
import { StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { getGearSuggestion } from '@/domain';
import { useWheelyColors } from '@/hooks/use-theme';
import { useGearMode, useResolvedTempUnit } from '@/hooks/settings-context';
import { Fonts, FontWeightBold, Spacing, type WheelyPalette } from '@/constants/theme';
import type { GearTipItem, RideStatus, Weather } from '@/types/weather';
import { BrutalCard, GameGearIcon } from './primitives';

function makeStyles(c: WheelyPalette) {
  return StyleSheet.create({
    headline: {
      color: c.ink,
      fontFamily: Fonts.heading,
      fontSize: 15,
      fontWeight: FontWeightBold,
      lineHeight: 20,
    },
    kitGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: Spacing.three,
      rowGap: Spacing.three,
      paddingTop: Spacing.two,
    },
    kitTile: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.two,
      borderWidth: 2,
      borderColor: c.border,
      borderRadius: 12,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.three,
    },
    kitIconWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      width: 64,
      height: 64,
    },
    textWrap: {
      alignItems: 'center',
      gap: Spacing.one,
      width: '100%',
    },
    bodyStrong: {
      color: c.ink,
      fontWeight: '400',
      fontSize: 14,
      lineHeight: 18,
      textAlign: 'center',
      flexShrink: 1,
    },
    muted: {
      color: c.mutedInk,
      fontSize: 12,
      lineHeight: 16,
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
  const [gridWidth, setGridWidth] = useState(0);
  const gear = getGearSuggestion(weather, mode, status, tempUnit);
  const { c, styles } = useStyles();
  const isWide = width >= 900;
  const columnCount = isWide ? 3 : 2;
  const gap = Spacing.three;
  const tileWidth = gridWidth > 0 ? (gridWidth - gap * (columnCount - 1)) / columnCount : undefined;

  const handleGridLayout = (event: LayoutChangeEvent) => {
    setGridWidth(event.nativeEvent.layout.width);
  };

  return (
    <BrutalCard>
      {!!gear.headline && <ThemedText style={styles.headline}>{gear.headline}</ThemedText>}
      <View style={styles.kitGrid} accessibilityLiveRegion="polite" onLayout={handleGridLayout}>
        {gear.items.map((item: GearTipItem, index: number) => {
          return (
            <View
              key={`${item.label}-${index}`}
              style={[
                styles.kitTile,
                tileWidth != null ? { width: tileWidth, minHeight: tileWidth } : null,
              ]}
            >
              <View style={styles.kitIconWrap}>
                <GameGearIcon iconKey={item.icon} size={56} color={c.mutedInk} />
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
