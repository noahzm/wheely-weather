import { useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { getGearSuggestion } from '@/domain';
import { useWheelyColors } from '@/hooks/use-theme';
import { useGearMode } from '@/hooks/settings-context';
import { FontWeightBlack, Fonts, Spacing, Type, type WheelyPalette } from '@/constants/theme';
import type { GearTipItem, Weather } from '@/types/weather';
import { BrutalCard, GameGearIcon } from './primitives';

function makeStyles(c: WheelyPalette) {
  return StyleSheet.create({
    group: {
      gap: Spacing.two,
    },
    groupLabel: {
      color: c.mutedInk,
      fontFamily: Fonts.heading,
      ...Type.caption,
      textTransform: 'uppercase',
      letterSpacing: 1,
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
    bringList: {
      gap: Spacing.two,
    },
    bringRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.two,
    },
    bringIconWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 32,
      height: 32,
    },
    bringTextWrap: {
      flex: 1,
      gap: 2,
    },
    bodyStrong: {
      color: c.ink,
      fontFamily: Fonts.bold,
      fontWeight: FontWeightBlack,
      ...Type.small,
      textAlign: 'center',
      flexShrink: 1,
    },
    bringLabel: {
      color: c.ink,
      fontFamily: Fonts.bold,
      fontWeight: FontWeightBlack,
      ...Type.small,
      flexShrink: 1,
    },
  });
}

function useStyles() {
  const c = useWheelyColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return { c, styles };
}

export function KitGuide({ weather }: Readonly<{ weather: Weather }>) {
  const [mode] = useGearMode();
  const { width } = useWindowDimensions();
  const gear = getGearSuggestion(weather, mode);
  const { c, styles } = useStyles();
  const isWide = width >= 900;
  const tileWidth = isWide ? '31%' : '47%';
  const hasBring = gear.bring.length > 0;

  return (
    <BrutalCard>
      <View style={styles.group} accessibilityLiveRegion="polite">
        {hasBring && <ThemedText style={styles.groupLabel}>Wear</ThemedText>}
        <View style={styles.kitGrid}>
          {gear.wear.map((item: GearTipItem, index: number) => (
            <View key={`${item.label}-${index}`} style={[styles.kitTile, { flexBasis: tileWidth }]}>
              <View style={styles.kitIconWrap}>
                <GameGearIcon iconKey={item.icon} size={42} color={c.mutedInk} />
              </View>
              <View style={styles.textWrap}>
                <ThemedText style={styles.bodyStrong}>{item.label}</ThemedText>
              </View>
            </View>
          ))}
        </View>
        {hasBring && (
          <>
            <ThemedText style={styles.groupLabel}>Bring</ThemedText>
            <View style={styles.bringList}>
              {gear.bring.map((item: GearTipItem, index: number) => (
                <View key={`${item.label}-${index}`} style={styles.bringRow}>
                  <View style={styles.bringIconWrap}>
                    <GameGearIcon iconKey={item.icon} size={28} color={c.mutedInk} />
                  </View>
                  <View style={styles.bringTextWrap}>
                    <ThemedText style={styles.bringLabel}>{item.label}</ThemedText>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}
      </View>
    </BrutalCard>
  );
}
