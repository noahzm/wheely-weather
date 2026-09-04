import { StyleSheet, View } from 'react-native';
import { Host, Picker, Text } from '@expo/ui/swift-ui';
import { pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';

import { GEAR_LABELS, GEAR_MODES, type GearMode } from '@/types/settings';

const styles = StyleSheet.create({
  container: {
    width: 164,
    height: 32,
    justifyContent: 'center',
  },
  host: {
    width: '100%',
    height: 32,
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
    <View style={styles.container}>
      <Host style={styles.host}>
        <Picker
          selection={mode}
          onSelectionChange={(val) => {
            onModeChange(val);
          }}
          modifiers={[pickerStyle('segmented')]}
        >
          {GEAR_MODES.map((modeKey, index) => (
            <Text key={modeKey} modifiers={[tag(modeKey)]}>
              {GEAR_LABELS[index]}
            </Text>
          ))}
        </Picker>
      </Host>
    </View>
  );
}
