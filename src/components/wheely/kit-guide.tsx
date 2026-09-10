import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { getGearSuggestion, getWearRows } from '@/domain';
import { useWheelyColors } from '@/hooks/use-theme';
import { useGearMode } from '@/hooks/settings-context';
import type { GearMode } from '@/types/settings';
import { FontWeightBlack, Fonts, Spacing, Type, type WheelyPalette } from '@/constants/theme';
import type { GearTipItem, Weather } from '@/types/weather';
import { BrutalCard, CardInnerRadius, KitGearIcon } from './primitives';
import { GearStylePicker } from './gear-style-picker';

function makeStyles(c: WheelyPalette) {
  return StyleSheet.create({
    cardPanel: {
      padding: 0,
      gap: 0,
    },
    cardClip: {
      borderRadius: CardInnerRadius,
      overflow: 'hidden',
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
      borderBottomWidth: 1,
      borderColor: c.border,
      backgroundColor: c.paper,
    },
    headerLabel: {
      color: c.ink,
      fontFamily: Fonts.bold,
      fontWeight: FontWeightBlack,
      ...Type.caption,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    wearGrid: {
      width: '100%',
      backgroundColor: c.paper,
    },
    wearRow: {
      flexDirection: 'row',
      width: '100%',
    },
    wearRowBorderBottom: {
      borderBottomWidth: 1,
      borderColor: c.border,
    },
    wearCell: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.one,
      paddingHorizontal: Spacing.two,
      paddingVertical: Spacing.three,
      minHeight: 110,
    },
    wearCellBorderRight: {
      borderRightWidth: 1,
      borderColor: c.border,
    },
    wearIconWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      width: 44,
      height: 44,
    },
    wearTextWrap: {
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: 2,
      width: '100%',
    },
    bodyStrong: {
      color: c.ink,
      fontFamily: Fonts.bold,
      fontWeight: FontWeightBlack,
      ...Type.small,
      textAlign: 'center',
      flexShrink: 1,
    },
    bringShelf: {
      backgroundColor: c.background,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
      borderTopWidth: 1,
      borderColor: c.border,
      gap: Spacing.one,
    },
    bringShelfWide: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.two,
    },
    bringHeader: {
      color: c.mutedInk,
      fontFamily: Fonts.bold,
      fontWeight: FontWeightBlack,
      ...Type.caption,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    bringItemsWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: Spacing.two,
    },
    bringItemsWrapWide: {
      flex: 1,
    },
    bringItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.one,
      paddingVertical: 2,
    },
    bringLabel: {
      color: c.ink,
      fontFamily: Fonts.bold,
      fontWeight: FontWeightBlack,
      ...Type.small,
    },
  });
}

function useStyles() {
  const c = useWheelyColors();
  const styles = makeStyles(c);
  return { c, styles };
}

export function KitGuide({
  weather,
  mode: controlledMode,
  showPicker = true,
}: Readonly<{
  weather: Weather;
  mode?: GearMode;
  showPicker?: boolean;
}>) {
  const [internalMode, setMode] = useGearMode();
  const mode = controlledMode ?? internalMode;
  const { width } = useWindowDimensions();
  const gear = getGearSuggestion(weather, mode);
  const { c, styles } = useStyles();
  const isWide = Platform.OS === 'web' && width >= 640;
  const rows = getWearRows(gear.wear, isWide);
  const hasBring = gear.bring.length > 0;

  return (
    <BrutalCard style={styles.cardPanel}>
      <View style={styles.cardClip} accessibilityLiveRegion="polite">
        {showPicker && (
          <View style={styles.headerRow}>
            <ThemedText style={styles.headerLabel}>Today’s kit</ThemedText>
            <GearStylePicker mode={mode} onModeChange={setMode} />
          </View>
        )}
        <View style={styles.wearGrid}>
          {rows.map((row, rowIndex) => {
            const isLastRow = rowIndex === rows.length - 1;
            return (
              <View
                key={`row-${rowIndex}`}
                style={[styles.wearRow, !isLastRow && styles.wearRowBorderBottom]}
              >
                {row.map((item: GearTipItem, colIndex: number) => {
                  const isLastCol = colIndex === row.length - 1;
                  return (
                    <View
                      key={`${item.label}-${colIndex}`}
                      accessible={true}
                      accessibilityLabel={item.label}
                      style={[styles.wearCell, !isLastCol && styles.wearCellBorderRight]}
                    >
                      <View style={styles.wearIconWrap}>
                        <KitGearIcon iconKey={item.icon} size={40} color={c.ink} />
                      </View>
                      <View style={styles.wearTextWrap}>
                        <ThemedText style={styles.bodyStrong}>{item.label}</ThemedText>
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </View>
        {hasBring && (
          <View style={[styles.bringShelf, isWide && styles.bringShelfWide]}>
            <ThemedText style={styles.bringHeader}>Bring</ThemedText>
            <View style={[styles.bringItemsWrap, isWide && styles.bringItemsWrapWide]}>
              {gear.bring.map((item: GearTipItem, index: number) => (
                <View
                  key={`${item.label}-${index}`}
                  accessible={true}
                  accessibilityLabel={item.label}
                  style={styles.bringItem}
                >
                  <KitGearIcon iconKey={item.icon} size={18} color={c.ink} />
                  <ThemedText style={styles.bringLabel}>{item.label}</ThemedText>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    </BrutalCard>
  );
}
