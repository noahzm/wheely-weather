import { useEffect, useState, type ComponentProps } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import {
  Button,
  Host,
  HStack,
  Image,
  Label,
  List,
  Picker,
  Section,
  Spacer,
  Text,
  Toggle,
} from '@expo/ui/swift-ui';
import {
  buttonStyle,
  disabled,
  foregroundStyle,
  listStyle,
  pickerStyle,
  tag,
  tint,
} from '@expo/ui/swift-ui/modifiers';

import AppleWeatherKitModule from '../../../modules/apple-weatherkit/src/AppleWeatherKitModule';
import type { WeatherKitAttribution } from '../../../modules/apple-weatherkit/src/AppleWeatherKit.types';
import { TRANSPARENT } from '@/constants/theme';
import { useWheelyColors } from '@/hooks/use-theme';
import {
  APPEARANCE_LABELS,
  APPEARANCE_VALUES,
  EXPOSURE_LABELS,
  EXPOSURE_VALUES,
  GEAR_LABELS,
  GEAR_MODES,
  TEMP_UNIT_LABELS,
  TEMP_UNIT_VALUES,
  type ExposureLevel,
  type SettingsFormProps,
} from './settings-form.types';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TRANSPARENT,
  },
  listHost: {
    flex: 1,
    backgroundColor: TRANSPARENT,
  },
});

/**
 * Apple's required WeatherKit attribution data (legal link). Credits-only:
 * failures (unlinked module, network error) resolve to null silently.
 */
function useWeatherAttribution(): WeatherKitAttribution | null {
  const [attribution, setAttribution] = useState<WeatherKitAttribution | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!AppleWeatherKitModule) return;
    AppleWeatherKitModule.attribution()
      .then((result) => {
        if (!cancelled) setAttribution(result);
      })
      .catch(() => {
        /* credits-only section; ignore failures */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return attribution;
}

function ExternalLinkRow({
  title,
  systemImage,
  url,
}: Readonly<{
  title: string;
  systemImage: NonNullable<ComponentProps<typeof Label>['systemImage']>;
  url: string;
}>) {
  return (
    <Button
      modifiers={[buttonStyle('plain')]}
      onPress={() => {
        Linking.openURL(url).catch(() => {
          /* row is a courtesy link; ignore failures */
        });
      }}
    >
      <HStack>
        <Label title={title} systemImage={systemImage} />
        <Spacer />
        <Image
          systemName="arrow.up.right"
          size={13}
          modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}
        />
      </HStack>
    </Button>
  );
}

function HomeClimateSectionIOS({
  homeOn,
  homeLabel,
  homeHint,
  canSetHome,
  exposureLevel,
  accentColor,
  onSetHome,
  onClearHome,
  onExposureChange,
}: Readonly<{
  homeOn: boolean;
  homeLabel: string | null;
  homeHint: string;
  canSetHome: boolean;
  exposureLevel: ExposureLevel;
  accentColor: string;
  onSetHome: () => void;
  onClearHome: () => void;
  onExposureChange: (level: ExposureLevel) => void;
}>) {
  return (
    <Section title="Home climate" footer={<Text>{homeHint}</Text>}>
      <Toggle
        isOn={homeOn}
        onIsOnChange={(value: boolean) => {
          if (value && canSetHome && !homeOn) onSetHome();
          else if (!value && homeOn) onClearHome();
        }}
        modifiers={[disabled(!homeOn && !canSetHome), tint(accentColor)]}
      >
        <Text>{homeLabel ?? 'Use current location as home'}</Text>
      </Toggle>
      {homeOn && (
        <Picker
          selection={exposureLevel}
          onSelectionChange={(value) => {
            onExposureChange(value);
          }}
          modifiers={[pickerStyle('segmented')]}
        >
          {EXPOSURE_VALUES.map((level, index) => (
            <Text key={level} modifiers={[tag(level)]}>
              {EXPOSURE_LABELS[index]}
            </Text>
          ))}
        </Picker>
      )}
    </Section>
  );
}

/**
 * iOS settings body — a native SwiftUI inset-grouped List (matching the
 * location search screen) with segmented pickers, the home-climate toggle,
 * and a combined credits section.
 */
export function SettingsForm({
  gearMode,
  onGearChange,
  appearance,
  onAppearanceChange,
  tempUnit,
  onTempUnitChange,
  exposureLevel,
  onExposureChange,
  homeLabel,
  canSetHome,
  onSetHome,
  onClearHome,
}: Readonly<SettingsFormProps>) {
  const c = useWheelyColors();
  const attribution = useWeatherAttribution();
  const homeOn = !!homeLabel;
  const homeHint = homeLabel
    ? 'Adapts heat and humidity thresholds to your home climate based on your daily outdoor exposure.'
    : 'Set your home to adapt the verdict to your climate. Requires regular outdoor exposure; if you spend most time in AC, keep this off.';

  return (
    <View style={styles.container}>
      <Host style={styles.listHost}>
        <List modifiers={[listStyle('insetGrouped')]}>
          <Section title="Ride style">
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

          <Section title="Units">
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
          </Section>

          <HomeClimateSectionIOS
            homeOn={homeOn}
            homeLabel={homeLabel}
            homeHint={homeHint}
            canSetHome={canSetHome}
            exposureLevel={exposureLevel}
            accentColor={c.accent}
            onSetHome={onSetHome}
            onClearHome={onClearHome}
            onExposureChange={onExposureChange}
          />

          <Section
            title="Credits"
            footer={
              <Text>
                Game-icons artwork by Lorc and Delapouite, licensed under CC BY 3.0. Apple Weather
                provides forecasts and severe weather alerts on iOS.
              </Text>
            }
          >
            <ExternalLinkRow
              title="Kit guide icons by game-icons.net"
              systemImage="paintbrush"
              url="https://game-icons.net/"
            />
            {attribution && (
              <ExternalLinkRow
                title="Apple Weather"
                systemImage="apple.logo"
                url={attribution.legalPageURL}
              />
            )}
          </Section>
        </List>
      </Host>
    </View>
  );
}
