import { Form, Host, Picker, Section, Text } from '@expo/ui/swift-ui';
import { pickerStyle, scrollContentBackground, tag } from '@expo/ui/swift-ui/modifiers';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TRANSPARENT } from '@/constants/theme';
import {
  APPEARANCE_LABELS,
  APPEARANCE_VALUES,
  GEAR_LABELS,
  GEAR_MODES,
  type SettingsFormProps,
} from './settings-form.types';

// Standard iOS navigation bar height; added to the top safe-area inset so the
// native Form clears the transparent (floating glass) header.
const NAV_BAR_HEIGHT = 44;

/**
 * iOS settings body — native SwiftUI grouped Form over the screen tartan backdrop.
 */
export function SettingsForm({
  gearMode,
  onGearChange,
  appearance,
  onAppearanceChange,
}: Readonly<SettingsFormProps>) {
  const insets = useSafeAreaInsets();
  return (
    <Host
      style={{ flex: 1, paddingTop: insets.top + NAV_BAR_HEIGHT, backgroundColor: TRANSPARENT }}
    >
      <Form modifiers={[scrollContentBackground('hidden')]}>
        <Section title="Gear">
          <Picker
            selection={gearMode}
            onSelectionChange={(value) => {
              onGearChange(value);
            }}
            modifiers={[pickerStyle('segmented')]}
          >
            {GEAR_MODES.map((mode, index) => (
              <Text key={mode} modifiers={[tag(mode)]}>
                {GEAR_LABELS[index]}
              </Text>
            ))}
          </Picker>
        </Section>
        <Section title="Appearance">
          <Picker
            selection={appearance}
            onSelectionChange={(value) => {
              onAppearanceChange(value);
            }}
            modifiers={[pickerStyle('segmented')]}
          >
            {APPEARANCE_VALUES.map((value, index) => (
              <Text key={value} modifiers={[tag(value)]}>
                {APPEARANCE_LABELS[index]}
              </Text>
            ))}
          </Picker>
        </Section>
      </Form>
    </Host>
  );
}
