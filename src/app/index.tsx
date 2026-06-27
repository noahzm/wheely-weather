import { useMemo, type ReactNode } from 'react';
import { Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { ScrollViewMarker } from 'react-native-screens/experimental';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Stack } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';

import {
  DailyForecast,
  ErrorState,
  HourlyForecast,
  KitGuide,
  LoadingState,
  RideSpecs,
  RideVerdict,
  SectionTitle,
  WeatherAlerts,
  useHomeHeaderOptions,
} from '@/components/wheely';
import { ScreenShell } from '@/components/tartan-background';
import { ThemedText } from '@/components/themed-text';
import {
  getDaylightWarning,
  getMessage,
  getOverallStatus,
  getRainTiming,
  getWeatherAlerts,
  getVerdictLabel,
} from '@/domain';
import { useForecast } from '@/hooks/forecast-context';
import { useWheelyColors } from '@/hooks/use-theme';
import type { Weather } from '@/types/weather';
import { MaxContentWidth, Spacing, TRANSPARENT, type WheelyPalette } from '@/constants/theme';

function Stagger({ order, children }: Readonly<{ order: number; children: ReactNode }>) {
  return (
    <Animated.View entering={FadeInDown.duration(380).delay(order * 70)}>{children}</Animated.View>
  );
}

function deriveHomeState(weather: Weather, location: string) {
  const status = getOverallStatus(weather);
  return {
    status,
    message: getMessage(weather, status),
    label: getVerdictLabel(status, location),
    rainTiming: getRainTiming(weather.hourly),
    daylightWarning: getDaylightWarning(weather.hourly, weather.daylight),
    alerts: getWeatherAlerts(weather),
  };
}

type HomeState = ReturnType<typeof deriveHomeState>;

function HomeSections({ weather, derived }: Readonly<{ weather: Weather; derived: HomeState }>) {
  const c = useWheelyColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <>
      <Stagger order={1}>
        <RideVerdict status={derived.status} message={derived.message} label={derived.label} />
      </Stagger>
      {derived.alerts.length > 0 && (
        <Stagger order={2}>
          <WeatherAlerts alerts={derived.alerts} />
        </Stagger>
      )}

      <Stagger order={3}>
        <View style={styles.section}>
          <SectionTitle title="Hour by hour" />
          <HourlyForecast
            hourly={weather.hourly}
            pastHourly={weather.pastHourly}
            rainTiming={derived.rainTiming}
            daylightWarning={derived.daylightWarning}
          />
        </View>
      </Stagger>

      <Stagger order={4}>
        <View style={styles.section}>
          <SectionTitle title="Today's kit" />
          <KitGuide weather={weather} />
        </View>
      </Stagger>

      <Stagger order={5}>
        <View style={styles.section}>
          <SectionTitle title="The numbers" />
          <RideSpecs weather={weather} />
        </View>
      </Stagger>

      <Stagger order={6}>
        <View style={styles.section}>
          <SectionTitle title="The week ahead" />
          <DailyForecast daily={weather.daily} />
        </View>
      </Stagger>
    </>
  );
}

export default function HomeScreen() {
  const forecast = useForecast();

  const weather = forecast.snapshot?.weather ?? null;
  const location = forecast.snapshot?.location ?? '';
  const derived = useMemo(
    () => (weather ? deriveHomeState(weather, location) : null),
    [weather, location],
  );

  const c = useWheelyColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const homeHeaderOptions = useHomeHeaderOptions();
  const headerHeight = useHeaderHeight();

  if (forecast.loading) {
    return (
      <ScreenShell>
        <LoadingState />
      </ScreenShell>
    );
  }
  if (forecast.errorKind) {
    return (
      <ScreenShell>
        <ErrorState kind={forecast.errorKind} onRetry={forecast.refresh} />
      </ScreenShell>
    );
  }

  const headerContent: ReactNode = forecast.statusMessage ? (
    <ThemedText style={styles.statusMessage}>{forecast.statusMessage}</ThemedText>
  ) : null;

  const scrollHostStyle = Platform.OS === 'web' ? styles.scrollHost : undefined;
  const scrollContentStyle =
    Platform.OS === 'web'
      ? [styles.scrollContent, { paddingTop: headerHeight + Spacing.three }]
      : styles.scrollContent;

  return (
    <ScreenShell>
      <View style={styles.screen}>
        <Stack.Screen options={homeHeaderOptions} />

        <ScrollViewMarker
          style={scrollHostStyle}
          scrollEdgeEffects={Platform.OS === 'ios' ? { top: 'soft', bottom: 'soft' } : undefined}
        >
          <ScrollView
            style={[styles.scroll, scrollHostStyle]}
            contentInsetAdjustmentBehavior="automatic"
            refreshControl={
              <RefreshControl refreshing={forecast.refreshing} onRefresh={forecast.refresh} />
            }
            contentContainerStyle={scrollContentStyle}
          >
            <SafeAreaView style={styles.safeArea} edges={['bottom']}>
              <View style={styles.content}>
                <Stagger order={0}>{headerContent}</Stagger>
                {weather && derived && <HomeSections weather={weather} derived={derived} />}
              </View>
            </SafeAreaView>
          </ScrollView>
        </ScrollViewMarker>
      </View>
    </ScreenShell>
  );
}

function makeStyles(c: WheelyPalette) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: TRANSPARENT,
    },
    scroll: {
      backgroundColor: TRANSPARENT,
    },
    scrollHost: {
      flex: 1,
      minHeight: 0,
    },
    scrollContent: {
      flexGrow: 1,
    },
    safeArea: {
      alignItems: 'center',
      paddingHorizontal: Spacing.three,
      paddingBottom: Spacing.three,
    },
    content: {
      width: '100%',
      maxWidth: MaxContentWidth,
      gap: 48,
    },
    section: {
      gap: Spacing.two,
    },
    statusMessage: {
      color: c.mutedInk,
      textAlign: 'center',
      fontSize: 13,
    },
  });
}
