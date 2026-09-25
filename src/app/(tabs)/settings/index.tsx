import { useCallback } from 'react';
import { Platform, View } from 'react-native';
import Head from 'expo-router/head';

import { SettingsForm, WebScreenHeader, WebScreenTitle } from '@/components/wheely';
import {
  useAppearance,
  useExposureLevel,
  useHomeLocation,
  useTempUnit,
} from '@/hooks/settings-context';
import { useForecast } from '@/hooks/forecast-context';
import { toHomeLocation } from '@/utils/homeLocation';
import { TRANSPARENT } from '@/constants/theme';

const isWeb = Platform.OS === 'web';

export default function SettingsScreen() {
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
    setHomeLocation(toHomeLocation(active, forecast.snapshot?.location));
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
          content="Configure comfort thresholds, units, and appearance options for your ride forecast."
        />
      </Head>
      <View style={{ flex: 1, backgroundColor: TRANSPARENT }} collapsable={false}>
        {isWeb && (
          <WebScreenHeader variant="title" title={<WebScreenTitle>Settings</WebScreenTitle>} />
        )}
        <SettingsForm
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
