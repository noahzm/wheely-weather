import { useCallback, useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing, Type, type WheelyPalette } from '@/constants/theme';
import { useColorSchemeName, useWheelyColors } from '@/hooks/use-theme';
import { withAlpha } from '@/utils/colors';
import { selectionFeedback } from '@/utils/haptics';

// Styled after the iOS segmented control: a grey capsule track with a raised
// thumb (white in light mode, a lighter grey in dark), not a colored fill.
const CONTAINER_PADDING = 2;
const INDICATOR_INSET = 0; // Horizontal padding inside each segment slot

function makeStyles(c: WheelyPalette, scheme: 'light' | 'dark') {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      backgroundColor: withAlpha(c.ink, scheme === 'dark' ? 0.14 : 0.07),
      borderRadius: Radius.pill,
      padding: CONTAINER_PADDING,
      position: 'relative',
    },
    segment: {
      flex: 1,
      paddingVertical: Spacing.two - Spacing.half,
      paddingHorizontal: Spacing.two,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: Radius.pill,
      zIndex: 2,
    },
    indicator: {
      position: 'absolute',
      top: CONTAINER_PADDING + INDICATOR_INSET,
      bottom: CONTAINER_PADDING + INDICATOR_INSET,
      backgroundColor: scheme === 'dark' ? withAlpha(c.ink, 0.3) : c.paper,
      borderRadius: Radius.pill,
      boxShadow: `0 2px 6px ${withAlpha(c.shadow, scheme === 'dark' ? 0 : 0.14)}`,
      zIndex: 1,
    },
    text: {
      color: c.ink,
      fontFamily: Fonts.body,
      ...Type.caption,
    },
    textActive: {
      fontFamily: Fonts.bold,
    },
  });
}

export function RNSegmentedPicker<T extends string>({
  values,
  labels,
  selectedValue,
  onSelect,
}: Readonly<{
  values: readonly T[];
  labels: readonly string[];
  selectedValue: T;
  onSelect: (value: T) => void;
}>) {
  const c = useWheelyColors();
  const styles = makeStyles(c, useColorSchemeName());

  const activeIndex = Math.max(0, values.indexOf(selectedValue));
  const count = values.length;
  const sharedIndex = useSharedValue(activeIndex);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    sharedIndex.value = withTiming(activeIndex, {
      duration: 140,
      easing: Easing.out(Easing.quad),
    });
  }, [activeIndex, sharedIndex]);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    if (width > 0) {
      setContainerWidth(width);
    }
  }, []);

  const indicatorStyle = useAnimatedStyle(() => {
    if (containerWidth === 0) {
      const widthPct = 100 / count;
      return {
        width: `${widthPct}%`,
        left: `${sharedIndex.value * widthPct}%`,
        opacity: 0,
      };
    }
    const innerWidth = containerWidth - CONTAINER_PADDING * 2;
    const segmentWidth = innerWidth / count;
    const pillWidth = Math.max(0, segmentWidth - INDICATOR_INSET * 2);
    const leftOffset = CONTAINER_PADDING + sharedIndex.value * segmentWidth + INDICATOR_INSET;

    return {
      width: pillWidth,
      left: leftOffset,
      opacity: 1,
    };
  }, [containerWidth, count]);

  return (
    <View style={styles.container} onLayout={handleLayout} accessibilityRole="radiogroup">
      <Animated.View style={[styles.indicator, indicatorStyle]} />
      {values.map((val, idx) => {
        const active = selectedValue === val;
        return (
          <Pressable
            key={val}
            style={styles.segment}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={labels[idx]}
            onPress={() => {
              selectionFeedback();
              onSelect(val);
            }}
          >
            <ThemedText style={[styles.text, active && styles.textActive]}>
              {labels[idx]}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}
