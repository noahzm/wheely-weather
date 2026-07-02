import { useCallback } from 'react';
import { Platform, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SettingsForm, WebScreenHeader, bottomNavBarHeight } from '@/components/wheely';
import { useGearMode, useAppearance, useHomeLocation, useTempUnit } from '@/hooks/settings-context';
import { useForecast } from '@/hooks/forecast-context';
import { useWheelyColors } from '@/hooks/use-theme';
import { Fonts, TRANSPARENT } from '@/constants/theme';

const isWeb = Platform.OS === 'web';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const c = useWheelyColors();
  const [gearMode, setGearMode] = useGearMode();
  const [appearance, setAppearance] = useAppearance();
  const [homeLocation, setHomeLocation] = useHomeLocation();
  const [tempUnit, setTempUnit] = useTempUnit();
  const forecast = useForecast();
  const bottomNavInset = isWeb ? bottomNavBarHeight(insets.bottom) : undefined;

  const active = forecast.savedLocation;
  const homeLabel =
    homeLocation?.name ??
    (homeLocation ? `${homeLocation.lat.toFixed(1)}, ${homeLocation.lon.toFixed(1)}` : null);

  const onSetHome = useCallback(() => {
    if (!active) return;
    setHomeLocation({
      lat: active.lat,
      lon: active.lon,
      name: forecast.snapshot?.location ?? active.name,
      source: active.source,
    });
  }, [active, forecast.snapshot?.location, setHomeLocation]);

  const onClearHome = useCallback(() => {
    setHomeLocation(null);
  }, [setHomeLocation]);

  return (
    <View
      style={[
        { flex: 1, backgroundColor: TRANSPARENT },
        bottomNavInset != null && { paddingBottom: bottomNavInset },
      ]}
      collapsable={false}
    >
      {isWeb && (
        <WebScreenHeader
          variant="title"
          title={
            <Text style={{ fontFamily: Fonts.monoBold, fontSize: 34, color: c.ink }}>Settings</Text>
          }
        />
      )}
      <SettingsForm
        gearMode={gearMode}
        onGearChange={setGearMode}
        appearance={appearance}
        onAppearanceChange={setAppearance}
        tempUnit={tempUnit}
        onTempUnitChange={setTempUnit}
        homeLabel={homeLabel}
        canSetHome={!!active}
        onSetHome={onSetHome}
        onClearHome={onClearHome}
      />
    </View>
  );
}
