import { useMemo, type ReactNode } from 'react';
import { Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';

import {
  DailyForecast,
  ErrorState,
  HourlyForecast,
  KitGuide,
  LoadingState,
  LocationPromptState,
  RideSpecs,
  RideVerdict,
  SectionTitle,
  WeatherAlerts,
  bottomNavBarHeight,
} from '@/components/wheely';
import { ThemedText } from '@/components/themed-text';
import {
  getAcclimatizationNote,
  getDaylightWarning,
  getMessage,
  getOverallStatus,
  getRainTiming,
  getWeatherAlerts,
  getVerdictLabel,
} from '@/domain';
import type { AcclimatizationContext } from '@/services/forecastSnapshot';
import { useForecast } from '@/hooks/forecast-context';
import { useWheelyColors } from '@/hooks/use-theme';
import type { Weather } from '@/types/weather';
import { contentColumnStyle, screenGutterStyle } from '@/components/wheely/content-column';
import { Spacing, TRANSPARENT, type WheelyPalette } from '@/constants/theme';

const isWeb = Platform.OS === 'web';

function Stagger({ order, children }: Readonly<{ order: number; children: ReactNode }>) {
  return (
    <Animated.View entering={FadeInDown.duration(380).delay(order * 70)}>{children}</Animated.View>
  );
}

function deriveHomeState(
  weather: Weather,
  location: string,
  acclimatization: AcclimatizationContext,
) {
  const { thresholds, homeBaseline } = acclimatization;
  const status = getOverallStatus(weather, thresholds);
  return {
    status,
    message: getMessage(weather, status, thresholds),
    label: getVerdictLabel(status, location),
    acclimatizationNote: getAcclimatizationNote(weather, homeBaseline),
    rainTiming: getRainTiming(weather.hourly),
    daylightWarning: getDaylightWarning(weather.hourly, weather.daylight),
    alerts: getWeatherAlerts(weather),
  };
}

type HomeState = ReturnType<typeof deriveHomeState>;

function HomeSections({
  weather,
  derived,
  thresholds,
}: Readonly<{
  weather: Weather;
  derived: HomeState;
  thresholds: AcclimatizationContext['thresholds'];
}>) {
  const c = useWheelyColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <>
      <Stagger order={1}>
        <RideVerdict
          status={derived.status}
          message={derived.message}
          label={derived.label}
          acclimatizationNote={derived.acclimatizationNote}
        />
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
          <SectionTitle title="Today’s kit" />
          <KitGuide weather={weather} status={derived.status} />
        </View>
      </Stagger>

      <Stagger order={5}>
        <View style={styles.section}>
          <SectionTitle title="The numbers" />
          <RideSpecs weather={weather} thresholds={thresholds} />
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
  const router = useRouter();

  const weather = forecast.snapshot?.weather ?? null;
  const location = forecast.snapshot?.location ?? '';
  const acclimatization = forecast.snapshot?.acclimatization ?? null;
  const derived = useMemo(
    () => (weather && acclimatization ? deriveHomeState(weather, location, acclimatization) : null),
    [weather, location, acclimatization],
  );

  const c = useWheelyColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const bottomNavInset = isWeb ? bottomNavBarHeight(insets.bottom) : undefined;

  if (forecast.loading) {
    return <LoadingState />;
  }
  if (forecast.errorKind) {
    return <ErrorState kind={forecast.errorKind} onRetry={forecast.refresh} />;
  }

  if (forecast.needsLocation) {
    return (
      <View style={styles.screen}>
        <LocationPromptState
          onChooseLocation={() => {
            router.push('/location');
          }}
        />
      </View>
    );
  }

  const headerContent: ReactNode = forecast.statusMessage ? (
    <ThemedText style={styles.statusMessage}>{forecast.statusMessage}</ThemedText>
  ) : null;

  const scrollHostStyle = isWeb ? styles.scrollHost : undefined;

  return (
    <View style={styles.screen} collapsable={false}>
      <ScrollView
        style={[styles.scroll, scrollHostStyle]}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl refreshing={forecast.refreshing} onRefresh={forecast.refresh} />
        }
        contentContainerStyle={styles.scrollContent}
      >
        <View
          style={[styles.safeArea, bottomNavInset != null && { paddingBottom: bottomNavInset }]}
        >
          <View style={styles.content}>
            <Stagger order={0}>{headerContent}</Stagger>
            {weather && derived && acclimatization && (
              <HomeSections
                weather={weather}
                derived={derived}
                thresholds={acclimatization.thresholds}
              />
            )}
          </View>
        </View>
      </ScrollView>
    </View>
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
      width: '100%',
      ...screenGutterStyle,
      paddingBottom: Spacing.three,
    },
    content: {
      ...contentColumnStyle,
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
