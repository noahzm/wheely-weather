import { useEffect, useRef, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

export const EXPAND_DURATION = 280;
export const EXPAND_EASING = Easing.out(Easing.cubic);

export function useExpandAnimation(open: boolean) {
  const reduceMotion = useReducedMotion();
  const openProgress = useSharedValue(open ? 1 : 0);
  const isFirstRender = useRef(true);

  useEffect(() => {
    const target = open ? 1 : 0;
    if (isFirstRender.current) {
      isFirstRender.current = false;
      openProgress.value = target;
      return;
    }

    openProgress.value = reduceMotion
      ? target
      : withTiming(target, { duration: EXPAND_DURATION, easing: EXPAND_EASING });
  }, [open, openProgress, reduceMotion]);

  return openProgress;
}

export function AnimatedExpand({
  openProgress,
  style,
  children,
}: Readonly<{
  openProgress: SharedValue<number>;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}>) {
  const contentHeight = useSharedValue(0);
  const hasContent = children != null && children !== false;

  const animatedStyle = useAnimatedStyle(() => {
    const measured = contentHeight.value;
    const progress = openProgress.value;
    if (progress <= 0) return { height: 0 };
    if (measured <= 0) return { height: 0 };
    return { height: measured * progress };
  });

  const onMeasureLayout = (height: number) => {
    if (!hasContent) {
      contentHeight.value = 0;
    } else if (height > contentHeight.value) {
      contentHeight.value = height;
    }
  };

  return (
    <View style={styles.expandRoot}>
      {hasContent ? (
        <View
          pointerEvents="none"
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          style={styles.hiddenMeasure}
          onLayout={(event) => {
            onMeasureLayout(event.nativeEvent.layout.height);
          }}
        >
          <View style={style}>{children}</View>
        </View>
      ) : null}
      <Animated.View style={[animatedStyle, styles.expandClip]}>
        {hasContent ? <View style={style}>{children}</View> : null}
      </Animated.View>
    </View>
  );
}

const styles = {
  expandRoot: {
    position: 'relative' as const,
  },
  hiddenMeasure: {
    position: 'absolute' as const,
    opacity: 0,
    left: 0,
    right: 0,
    zIndex: -1,
  },
  expandClip: {
    overflow: 'hidden' as const,
  },
};
