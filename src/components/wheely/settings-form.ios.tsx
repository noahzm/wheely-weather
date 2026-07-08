import { ScrollView, StyleSheet, View } from 'react-native';
import { Host, Picker, Text } from '@expo/ui/swift-ui';
import { pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';

import { Spacing, TRANSPARENT } from '@/constants/theme';
import {
  APPEARANCE_LABELS,
  APPEARANCE_VALUES,
  GEAR_LABELS,
  GEAR_MODES,
  TEMP_UNIT_LABELS,
  TEMP_UNIT_VALUES,
  type SettingsFormProps,
} from './settings-form.types';
import { BrutalCard, SectionTitle } from './primitives';
import { HomeClimateSection } from './settings-home-section';
import { WeatherAttributionSection } from './settings-attribution-section.ios';

// Intrinsic height of a SwiftUI segmented Picker; the Host needs an explicit size.
const SEGMENTED_HEIGHT = 34;

const styles = StyleSheet.create({
  scroll: {
    backgroundColor: TRANSPARENT,
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
  },
  group: {
    gap: Spacing.two,
  },
  host: {
    height: SEGMENTED_HEIGHT,
    backgroundColor: TRANSPARENT,
  },
});

/**
 * iOS settings body — native SwiftUI segmented Pickers inside the app's BrutalCard
 * surfaces, with SectionTitle headings, to match the location screen's design.
 */
export function SettingsForm({
  gearMode,
  onGearChange,
  appearance,
  onAppearanceChange,
  tempUnit,
  onTempUnitChange,
  homeLabel,
  canSetHome,
  onSetHome,
  onClearHome,
}: Readonly<SettingsFormProps>) {
  return (
    <ScrollView
      style={styles.scroll}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
    >
      <View style={styles.group}>
        <SectionTitle title="Gear" />
        <BrutalCard>
          <Host style={styles.host}>
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
          </Host>
        </BrutalCard>
      </View>

      <View style={styles.group}>
        <SectionTitle title="Appearance" />
        <BrutalCard>
          <Host style={styles.host}>
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
          </Host>
        </BrutalCard>
      </View>

      <View style={styles.group}>
        <SectionTitle title="Units" />
        <BrutalCard>
          <Host style={styles.host}>
            <Picker
              selection={tempUnit}
              onSelectionChange={(value) => {
                onTempUnitChange(value);
              }}
              modifiers={[pickerStyle('segmented')]}
            >
              {TEMP_UNIT_VALUES.map((value, index) => (
                <Text key={value} modifiers={[tag(value)]}>
                  {TEMP_UNIT_LABELS[index]}
                </Text>
              ))}
            </Picker>
          </Host>
        </BrutalCard>
      </View>

      <HomeClimateSection
        homeLabel={homeLabel}
        canSetHome={canSetHome}
        onSetHome={onSetHome}
        onClearHome={onClearHome}
      />

      <WeatherAttributionSection />
    </ScrollView>
  );
}
