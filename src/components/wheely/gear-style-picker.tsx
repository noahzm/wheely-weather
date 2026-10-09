import { StyleSheet, View } from 'react-native';

import { GEAR_LABELS, GEAR_MODES, type GearMode } from '@/types/settings';
import { RNSegmentedPicker } from './rn-segmented-picker';

// Same width as the iOS segmented picker (gear-style-picker.ios.tsx).
const styles = StyleSheet.create({
  container: {
    width: 164,
  },
});

export function GearStylePicker({
  mode,
  onModeChange,
}: Readonly<{
  mode: GearMode;
  onModeChange: (mode: GearMode) => void;
}>) {
  return (
    <View style={styles.container} accessibilityLabel="Rider style">
      <RNSegmentedPicker
        values={GEAR_MODES}
        labels={GEAR_LABELS}
        selectedValue={mode}
        onSelect={onModeChange}
      />
    </View>
  );
}
