import { useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { getGearSuggestion } from '@/domain';
import { useWheelyColors } from '@/hooks/use-theme';
import { useGearMode, useResolvedTempUnit } from '@/hooks/settings-context';
import {
  FontWeightBlack,
  Fonts,
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
      ...Type.body,
    },
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
    muted: {
      color: c.mutedInk,
      ...Type.caption,
      textAlign: 'center',
      flexShrink: 1,
    },
    bringMuted: {
      color: c.mutedInk,
      ...Type.caption,
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
  const hasBring = gear.bring.length > 0;

  return (
    <BrutalCard>
      {!!gear.headline && <ThemedText style={styles.headline}>{gear.headline}</ThemedText>}
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
                {!!item.qualifier && <ThemedText style={styles.muted}>{item.qualifier}</ThemedText>}
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
                    {!!item.qualifier && (
                      <ThemedText style={styles.bringMuted}>{item.qualifier}</ThemedText>
                    )}
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
