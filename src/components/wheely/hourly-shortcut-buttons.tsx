import { useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, Type, type WheelyPalette } from '@/constants/theme';
import { useWheelyColors } from '@/hooks/use-theme';
import { HapticPressable, PressedOpacity } from './primitives';

function makeStyles(c: WheelyPalette) {
  return StyleSheet.create({
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
    shortcut: {
      justifyContent: 'center',
      minHeight: 32,
      paddingHorizontal: Spacing.two + Spacing.half,
      paddingVertical: Spacing.half,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: Radius.pill,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null),
    },
    shortcutSelected: { backgroundColor: c.accent },
    shortcutText: { color: c.ink, ...Type.micro },
    shortcutSelectedText: { color: c.accentInk },
  });
}

export function HourlyShortcutButtons({
  nowIdx,
  bestRideIdx,
  selectedIdx,
  onSelectIndex,
}: Readonly<{
  nowIdx: number;
  bestRideIdx: number | null;
  selectedIdx: number;
  onSelectIndex: (index: number) => void;
}>) {
  const c = useWheelyColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const shortcuts = [
    { label: 'Now', index: nowIdx },
    ...(bestRideIdx == null ? [] : [{ label: 'Best ride', index: bestRideIdx }]),
  ];

  return (
    <View style={styles.row}>
      {shortcuts.map(({ label, index }) => (
        <HapticPressable
          key={label}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ selected: selectedIdx === index }}
          accessibilityHint="Center this hour on the riding conditions chart"
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          onPress={() => {
            onSelectIndex(index);
          }}
          style={({ pressed }) => [
            styles.shortcut,
            selectedIdx === index && styles.shortcutSelected,
            pressed && { opacity: PressedOpacity },
          ]}
        >
          <ThemedText
            style={[styles.shortcutText, selectedIdx === index && styles.shortcutSelectedText]}
          >
            {label}
          </ThemedText>
        </HapticPressable>
      ))}
    </View>
  );
}
