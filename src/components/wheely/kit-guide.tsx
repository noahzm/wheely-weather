import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { getGearSuggestion, getWearRows, type RideHours } from '@/domain';
import type { Thresholds } from '@/domain/constants';
import { useWheelyColors } from '@/hooks/use-theme';
import { useGearMode, useRideDuration } from '@/hooks/settings-context';
import { RIDE_DURATION_HOURS, type GearMode } from '@/types/settings';
import {
  Fonts,
  Radius,
  Spacing,
  Type,
  type WheelyPalette,
  FontWeightSemibold,
} from '@/constants/theme';
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
      borderColor: c.divider,
      backgroundColor: c.paper,
    },
    headerLabel: {
      color: c.ink,
      fontFamily: Fonts.bold,
      fontWeight: FontWeightSemibold,
      ...Type.micro,
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
      borderColor: c.divider,
    },
    wearCell: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: Spacing.one,
      paddingHorizontal: Spacing.two,
      paddingVertical: Spacing.three,
      minHeight: 110,
    },
    wearCellBorderRight: {
      borderRightWidth: 1,
      borderColor: c.divider,
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
    wearLabel: {
      color: c.ink,
      fontFamily: Fonts.body,
      fontWeight: '400',
      ...Type.small,
      textAlign: 'center',
      flexShrink: 1,
    },
    bringShelf: {
      backgroundColor: c.background,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
      borderTopWidth: 1,
      borderColor: c.divider,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: Spacing.two,
    },
    bringHeader: {
      color: c.mutedInk,
      fontFamily: Fonts.bold,
      fontWeight: FontWeightSemibold,
      ...Type.micro,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginRight: Spacing.half,
    },
    bringItemsWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: Spacing.one,
      flex: 1,
    },
    bringItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: c.paper,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.two,
      paddingVertical: 4,
    },
    bringLabel: {
      color: c.ink,
      fontFamily: Fonts.body,
      fontWeight: '400',
      ...Type.micro,
    },
  });
}

function preventOrphan(label: string): string {
  const lastSpaceIdx = label.lastIndexOf(' ');
  if (lastSpaceIdx <= 0 || label.indexOf(' ') === lastSpaceIdx) return label;
  return `${label.slice(0, lastSpaceIdx)}\u00A0${label.slice(lastSpaceIdx + 1)}`;
}

function useStyles() {
  const c = useWheelyColors();
  const styles = makeStyles(c);
  return { c, styles };
}

export function KitGuide({
  weather,
  rideHours = null,
  thresholds,
  mode: controlledMode,
  showPicker = true,
}: Readonly<{
  weather: Weather;
  /** The verdict's window to dress for; without one, the next few hours. */
  rideHours?: RideHours | null;
  thresholds: Thresholds;
  mode?: GearMode;
  showPicker?: boolean;
}>) {
  const [internalMode, setMode] = useGearMode();
  const [rideDuration] = useRideDuration();
  const mode = controlledMode ?? internalMode;
  const { width } = useWindowDimensions();
  const gear = getGearSuggestion(
    weather,
    mode,
    rideHours,
    thresholds,
    RIDE_DURATION_HOURS[rideDuration],
  );
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
                  const itemDelay = (rowIndex * 2 + colIndex) * 35;
                  return (
                    <View
                      key={`${rowIndex}-${colIndex}`}
                      accessible={true}
                      accessibilityLabel={item.label}
                      style={[styles.wearCell, !isLastCol && styles.wearCellBorderRight]}
                    >
                      <Animated.View
                        key={`icon-${mode}-${item.icon}-${item.label}`}
                        entering={ZoomIn.delay(itemDelay).springify().damping(15)}
                        style={styles.wearIconWrap}
                      >
                        <KitGearIcon iconKey={item.icon} size={40} color={c.ink} />
                      </Animated.View>
                      <Animated.View
                        key={`label-${mode}-${item.label}`}
                        entering={FadeInDown.delay(itemDelay).duration(200)}
                        style={styles.wearTextWrap}
                      >
                        <ThemedText style={styles.wearLabel}>
                          {preventOrphan(item.label)}
                        </ThemedText>
                      </Animated.View>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </View>
        {hasBring && (
          <View style={styles.bringShelf}>
            <ThemedText style={styles.bringHeader}>Bring</ThemedText>
            <View style={styles.bringItemsWrap}>
              {gear.bring.map((item: GearTipItem, index: number) => (
                <Animated.View
                  key={`${mode}-${item.label}-${index}`}
                  entering={FadeInDown.delay(index * 40).duration(200)}
                  accessible={true}
                  accessibilityLabel={item.label}
                  style={styles.bringItem}
                >
                  <KitGearIcon iconKey={item.icon} size={15} color={c.ink} />
                  <ThemedText style={styles.bringLabel}>{preventOrphan(item.label)}</ThemedText>
                </Animated.View>
              ))}
            </View>
          </View>
        )}
      </View>
    </BrutalCard>
  );
}
