import { useMemo } from 'react';
// eslint-disable-next-line import/no-named-as-default
import SegmentedControl from '@expo/ui/community/segmented-control';
import { Package } from 'lucide-react-native';
import { Platform, StyleSheet, View } from 'react-native';
import { SymbolView, type SFSymbol } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { getGearSuggestion } from '@/domain';
import { useColorSchemeName, useWheelyColors } from '@/hooks/use-theme';
import { useGearMode } from '@/hooks/use-gear-mode';
import { Spacing, type WheelyPalette } from '@/constants/theme';
import type { GearTipItem, Weather } from '@/types/weather';
import { BrutalCard, GEAR_ICONS, GEAR_SF_SYMBOLS } from './primitives';

const GEAR_OPTIONS = ['Everyday', 'Performance'] as const;
const GEAR_MODES = ['casual', 'pro'] as const;

function makeStyles(c: WheelyPalette) {
  return StyleSheet.create({
    kitSegmentedControl: {
      marginBottom: Spacing.two,
      alignSelf: 'stretch',
    },
    bodyStrong: {
      color: c.ink,
      fontWeight: '400',
      fontSize: 15,
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

function GearModeToggle({
  mode,
  onSelect,
}: Readonly<{
  mode: 'casual' | 'pro';
  onSelect: (mode: 'casual' | 'pro') => void;
}>) {
  const { styles } = useStyles();
  const colorScheme = useColorSchemeName();

  return (
    <SegmentedControl
      values={[...GEAR_OPTIONS]}
      selectedIndex={mode === 'pro' ? 1 : 0}
      appearance={colorScheme}
      onChange={(event) => {
        const index = event.nativeEvent.selectedSegmentIndex;
        onSelect(GEAR_MODES[index] ?? 'casual');
      }}
      style={styles.kitSegmentedControl}
    />
  );
}

export function KitGuide({ weather }: Readonly<{ weather: Weather }>) {
  const [mode, setMode] = useGearMode();
  const gear = getGearSuggestion(weather, mode);
  const { c, styles } = useStyles();

  return (
    <BrutalCard>
      <GearModeToggle mode={mode} onSelect={setMode} />
      {!!gear.headline && <ThemedText style={styles.bodyStrong}>{gear.headline}</ThemedText>}
      <View accessibilityLiveRegion="polite">
        {gear.items.map((item: GearTipItem, index: number) => {
          const Icon = GEAR_ICONS[item.icon] ?? Package;
          const sfName = GEAR_SF_SYMBOLS[item.icon] ?? 'shippingbox.fill';
          return (
            <View key={`${item.label}-${index}`} style={styles.kitRow}>
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
