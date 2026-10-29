import { useEffect } from 'react';
import { Pressable } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useWheelyColors } from '@/hooks/use-theme';
import { Radius, WheelyTheme } from '@/constants/theme';
import { withAlpha } from '@/utils/colors';
import { selectionFeedback } from '@/utils/haptics';
import { WebHitSlop } from './primitives';

// iOS switch geometry.
const SWITCH_WIDTH = 51;
const SWITCH_HEIGHT = 31;
const SWITCH_PADDING = 2;
const THUMB_SIZE = SWITCH_HEIGHT - SWITCH_PADDING * 2;
// The thumb is white in both schemes, as on iOS; a shadow lifts it off a light track.
const THUMB_COLOR = WheelyTheme.light.paper;
const THUMB_SHADOW = `0 2px 4px ${withAlpha(WheelyTheme.light.shadow, 0.2)}`;
// Reaches the switch's 51×31 past 44pt to take taps.
const SWITCH_HIT_SLOP = { top: 10, bottom: 10, left: 6, right: 6 };

export function RNSwitch({
  value,
  disabled,
  onValueChange,
  accessibilityLabel,
}: Readonly<{
  value: boolean;
  disabled?: boolean;
  onValueChange: (val: boolean) => void;
  accessibilityLabel?: string;
}>) {
  const c = useWheelyColors();
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, {
      duration: 140,
      easing: Easing.out(Easing.quad),
    });
  }, [value, progress]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * (SWITCH_WIDTH - SWITCH_HEIGHT) }],
  }));

  return (
    <Pressable
      onPress={() => {
        if (!disabled) {
          selectionFeedback();
          onValueChange(!value);
        }
      }}
      disabled={disabled}
      hitSlop={SWITCH_HIT_SLOP}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      style={{
        width: SWITCH_WIDTH,
        height: SWITCH_HEIGHT,
        borderRadius: Radius.pill,
        backgroundColor: value ? c.accent : withAlpha(c.ink, 0.16),
        padding: SWITCH_PADDING,
        justifyContent: 'center',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <WebHitSlop hitSlop={SWITCH_HIT_SLOP} />
      <Animated.View
        style={[
          {
            width: THUMB_SIZE,
            height: THUMB_SIZE,
            borderRadius: Radius.pill,
            backgroundColor: THUMB_COLOR,
            boxShadow: THUMB_SHADOW,
          },
          thumbStyle,
        ]}
      />
    </Pressable>
  );
}
