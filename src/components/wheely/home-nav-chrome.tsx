import { useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Map, MapPin, Settings } from 'lucide-react-native';
import { SymbolView } from 'expo-symbols';
import { useRouter } from 'expo-router';

import { useForecast } from '@/hooks/forecast-context';
import { useWheelyColors } from '@/hooks/use-theme';
import { Fonts, Spacing } from '@/constants/theme';
import { GlassChrome } from './glass-chrome';
import { HapticPressable, makeButtonStyles } from './primitives';

const NAV_ICON_SIZE = 36;
const NAV_PILL_RADIUS = 22;
const isIos = Platform.OS === 'ios';
const usesSurfaceChrome = Platform.OS === 'web' || Platform.OS === 'android';

function DeviceLocationIcon({ color }: Readonly<{ color: string }>) {
  if (isIos) {
    return <SymbolView name="location.fill" size={13} tintColor={color} />;
  }
  return <MapPin size={13} color={color} strokeWidth={2.5} />;
}

function useNavChromeStyles() {
  const c = useWheelyColors();
  return useMemo(() => {
    const button = makeButtonStyles(c);
    return StyleSheet.create({
      iconButton: {
        ...button.base,
        ...button.surface,
        width: NAV_ICON_SIZE,
        height: NAV_ICON_SIZE,
        minHeight: NAV_ICON_SIZE,
        borderRadius: NAV_ICON_SIZE / 2,
        paddingHorizontal: 0,
        paddingVertical: 0,
      },
      locationPillContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: Spacing.three,
        paddingVertical: Spacing.two,
      },
      locationPill: {
        ...button.base,
        ...button.surface,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        borderRadius: NAV_PILL_RADIUS,
        paddingHorizontal: Spacing.three,
        paddingVertical: Spacing.two,
        minHeight: 0,
      },
      locationLabel: {
        fontFamily: Fonts.monoBold,
        fontSize: 16,
        color: c.ink,
      },
    });
  }, [c]);
}

function NavSearchButton() {
  const router = useRouter();
  const c = useWheelyColors();
  const styles = useNavChromeStyles();

  return (
    <HapticPressable
      onPress={() => {
        router.push('/location');
      }}
      accessibilityRole="button"
      accessibilityLabel="Search location"
      style={({ pressed }) => [
        usesSurfaceChrome ? styles.iconButton : undefined,
        {
          width: NAV_ICON_SIZE,
          height: NAV_ICON_SIZE,
          alignItems: 'center',
          justifyContent: 'center',
        },
        pressed && usesSurfaceChrome && { opacity: 0.85 },
      ]}
    >
      {isIos ? (
        <SymbolView name="map.fill" size={17} type="hierarchical" tintColor={c.ink} />
      ) : (
        <Map size={17} color={c.ink} strokeWidth={2.5} />
      )}
    </HapticPressable>
  );
}

function NavLocationTitle() {
  const forecast = useForecast();
  const c = useWheelyColors();
  const styles = useNavChromeStyles();

  const label = forecast.snapshot?.location ?? 'Set location';
  const deviceIcon =
    forecast.savedLocation?.source === 'device' ? <DeviceLocationIcon color={c.ink} /> : null;

  if (isIos) {
    return (
      <GlassChrome style={{ borderRadius: NAV_PILL_RADIUS }}>
        <View style={styles.locationPillContent}>
          {deviceIcon}
          <Text style={styles.locationLabel}>{label}</Text>
        </View>
      </GlassChrome>
    );
  }

  return (
    <View style={styles.locationPill}>
      {deviceIcon}
      <Text style={styles.locationLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function NavSettingsButton() {
  const router = useRouter();
  const c = useWheelyColors();
  const styles = useNavChromeStyles();

  return (
    <HapticPressable
      onPress={() => {
        router.push('/settings');
      }}
      accessibilityRole="button"
      accessibilityLabel="Settings"
      style={({ pressed }) => [
        usesSurfaceChrome ? styles.iconButton : undefined,
        {
          width: NAV_ICON_SIZE,
          height: NAV_ICON_SIZE,
          alignItems: 'center',
          justifyContent: 'center',
        },
        pressed && usesSurfaceChrome && { opacity: 0.85 },
      ]}
    >
      {isIos ? (
        <SymbolView name="gearshape.fill" size={18} tintColor={c.ink} />
      ) : (
        <Settings size={18} color={c.ink} strokeWidth={2.5} />
      )}
    </HapticPressable>
  );
}

const webHeaderInset = Platform.OS === 'web' ? { paddingTop: Spacing.two } : null;

export function useHomeHeaderOptions() {
  const c = useWheelyColors();

  return {
    headerShown: true as const,
    headerTransparent: true as const,
    headerTintColor: c.ink,
    headerTitleAlign: 'center' as const,
    headerLeftContainerStyle: [
      webHeaderInset,
      usesSurfaceChrome ? { paddingLeft: Spacing.two } : null,
    ],
    headerRightContainerStyle: [
      webHeaderInset,
      usesSurfaceChrome ? { paddingRight: Spacing.two } : null,
    ],
    headerLeft: () => <NavSearchButton />,
    headerTitle: () => <NavLocationTitle />,
    headerRight: () => <NavSettingsButton />,
  };
}
