import { useMemo } from 'react';
import { Package } from 'lucide-react-native';
import { Platform, StyleSheet, View } from 'react-native';
import { SymbolView, type SFSymbol } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { getGearSuggestion } from '@/domain';
import { useWheelyColors } from '@/hooks/use-theme';
import { useGearMode } from '@/hooks/settings-context';
import { Fonts, FontWeightBold, Spacing, type WheelyPalette } from '@/constants/theme';
import type { GearTipItem, RideStatus, Weather } from '@/types/weather';
import { BrutalCard, GEAR_ICONS, GEAR_SF_SYMBOLS } from './primitives';

function makeStyles(c: WheelyPalette) {
  return StyleSheet.create({
    bodyStrong: {
      color: c.ink,
      fontWeight: '400',
      fontSize: 15,
      lineHeight: 20,
    },
    headline: {
      color: c.ink,
      fontFamily: Fonts.monoBold,
      fontSize: 15,
      fontWeight: FontWeightBold,
      lineHeight: 20,
    },
    kitRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.three,
      paddingVertical: Spacing.three,
      borderBottomWidth: 2,
      borderColor: c.border,
    },
    kitRowLast: { borderBottomWidth: 0, paddingBottom: 0 },
    kitIcon: {
      width: 28,
    },
    flex: { flex: 1 },
    muted: {
      color: c.mutedInk,
      fontSize: 13,
      lineHeight: 18,
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
  const gear = getGearSuggestion(weather, mode, status);
  const { c, styles } = useStyles();

  return (
    <BrutalCard>
      {!!gear.headline && <ThemedText style={styles.headline}>{gear.headline}</ThemedText>}
      <View accessibilityLiveRegion="polite">
        {gear.items.map((item: GearTipItem, index: number) => {
          const Icon = GEAR_ICONS[item.icon] ?? Package;
          const sfName = GEAR_SF_SYMBOLS[item.icon] ?? 'shippingbox.fill';
          return (
            <View
              key={`${item.label}-${index}`}
              style={[styles.kitRow, index === gear.items.length - 1 && styles.kitRowLast]}
            >
              {Platform.OS === 'ios' ? (
                <SymbolView
                  name={sfName as SFSymbol}
                  size={20}
                  tintColor={c.mutedInk}
                  style={styles.kitIcon}
                />
              ) : (
                <Icon size={20} color={c.mutedInk} strokeWidth={1.75} style={styles.kitIcon} />
              )}
              <View style={styles.flex}>
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
