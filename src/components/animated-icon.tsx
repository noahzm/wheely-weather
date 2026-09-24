import { useState } from 'react';
import { Appearance, Dimensions, StyleSheet } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const INITIAL_SCALE_FACTOR = Dimensions.get('screen').height / 90;
const DURATION = 600;
// Must match the native splash `backgroundColor` and `dark.backgroundColor` in
// app.json (expo-splash-screen) so the JS overlay hands off seamlessly —
// intentionally not palette tokens (they are the app icon's sky colors).
const SPLASH_BG_LIGHT = '#F1BDF2';
const SPLASH_BG_DARK = '#2E1F5E';

export function AnimatedSplashOverlay() {
  const [visible, setVisible] = useState(true);
  // Read once at mount: the native splash follows the system scheme, and the
  // in-app appearance override is only applied in an effect after this render.
  const [backgroundColor] = useState(() =>
    Appearance.getColorScheme() === 'dark' ? SPLASH_BG_DARK : SPLASH_BG_LIGHT,
  );

  if (!visible) return null;

  const splashKeyframe = new Keyframe({
    0: {
      transform: [{ scale: INITIAL_SCALE_FACTOR }],
      opacity: 1,
    },
    20: {
      opacity: 1,
    },
    70: {
      opacity: 0,
      easing: Easing.elastic(0.7),
    },
    100: {
      opacity: 0,
      transform: [{ scale: 1 }],
      easing: Easing.elastic(0.7),
    },
  });

  return (
    <Animated.View
      entering={splashKeyframe.duration(DURATION).withCallback((finished) => {
        'worklet';
        if (finished) {
          scheduleOnRN(setVisible, false);
        }
      })}
      style={[styles.backgroundSolidColor, { backgroundColor }]}
    />
  );
}

const styles = StyleSheet.create({
  backgroundSolidColor: {
    ...StyleSheet.absoluteFill,
    zIndex: 1000,
  },
});
