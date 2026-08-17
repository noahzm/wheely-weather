import { useCallback } from 'react';
import { Platform, View } from 'react-native';
import Head from 'expo-router/head';

import { SettingsForm, WebScreenHeader, WebScreenTitle } from '@/components/wheely';
import {
  useAppearance,
  useExposureLevel,
  useGearMode,
  useHomeLocation,
  useTempUnit,
} from '@/hooks/settings-context';
import { useForecast } from '@/hooks/forecast-context';
import { abbreviateTrailingUSState } from '@/utils/us-states';
import { TRANSPARENT } from '@/constants/theme';

const isWeb = Platform.OS === 'web';

export default function SettingsScreen() {
  const [gearMode, setGearMode] = useGearMode();
  const [appearance, setAppearance] = useAppearance();
  const [homeLocation, setHomeLocation] = useHomeLocation();
  const [tempUnit, setTempUnit] = useTempUnit();
  const [exposureLevel, setExposureLevel] = useExposureLevel();
  const forecast = useForecast();

  const active = forecast.savedLocation;
  const homeBaseline = forecast.snapshot?.acclimatization.homeBaseline ?? null;
  const homeLabel =
    homeLocation?.name ??
    (homeLocation ? `${homeLocation.lat.toFixed(1)}, ${homeLocation.lon.toFixed(1)}` : null);

  const onSetHome = useCallback(() => {
    if (!active) return;
    const name = forecast.snapshot?.location ?? active.name;
    setHomeLocation({
      lat: active.lat,
      lon: active.lon,
      name: name ? abbreviateTrailingUSState(name) : name,
      source: active.source,
    });
  }, [active, forecast.snapshot?.location, setHomeLocation]);

  const onClearHome = useCallback(() => {
    setHomeLocation(null);
  }, [setHomeLocation]);

  return (
    <>
      <Head>
        <title>Settings — Wheely Weather</title>
        <meta
          name="description"
          content="Configure gear preferences, comfort thresholds, and appearance options for your ride forecast."
        />
      </Head>
      <View style={{ flex: 1, backgroundColor: TRANSPARENT }} collapsable={false}>
        {isWeb && (
          <WebScreenHeader variant="title" title={<WebScreenTitle>Settings</WebScreenTitle>} />
        )}
        <SettingsForm
          gearMode={gearMode}
          onGearChange={setGearMode}
          appearance={appearance}
          onAppearanceChange={setAppearance}
          tempUnit={tempUnit}
          onTempUnitChange={setTempUnit}
          exposureLevel={exposureLevel}
          onExposureChange={setExposureLevel}
          homeBaseline={homeBaseline}
          homeLabel={homeLabel}
          canSetHome={!!active}
          onSetHome={onSetHome}
          onClearHome={onClearHome}
        />
      </View>
    </>
  );
}
