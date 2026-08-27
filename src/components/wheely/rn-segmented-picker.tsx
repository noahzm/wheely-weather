import { useCallback, useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing, Type, type WheelyPalette } from '@/constants/theme';
import { useWheelyColors } from '@/hooks/use-theme';
import { selectionFeedback } from '@/utils/haptics';

const CONTAINER_PADDING = 4;
const INDICATOR_INSET = 2; // Horizontal padding inside each segment slot

function makeStyles(c: WheelyPalette) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      backgroundColor: c.background,
      borderColor: c.border,
      borderWidth: 1,
      borderRadius: 10,
      padding: CONTAINER_PADDING,
      position: 'relative',
    },
    segment: {
      flex: 1,
      paddingVertical: Spacing.two,
      paddingHorizontal: Spacing.two,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 6,
      zIndex: 2,
    },
    indicator: {
      position: 'absolute',
      top: CONTAINER_PADDING + INDICATOR_INSET,
      bottom: CONTAINER_PADDING + INDICATOR_INSET,
      backgroundColor: c.accent,
      borderRadius: 6,
      zIndex: 1,
    },
    text: {
      color: c.mutedInk,
      fontFamily: Fonts.body,
      ...Type.caption,
    },
    textActive: {
      color: c.accentInk,
      fontFamily: Fonts.heading,
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
  const styles = makeStyles(c);

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
