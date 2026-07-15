import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import Head from 'expo-router/head';

import {
  DailyForecast,
  ErrorState,
  HourlyForecast,
  KitGuide,
  LoadingState,
  LocationPromptState,
  RideSpecs,
  RideVerdict,
  StaleDataNotice,
  WeatherAlerts,
  WebScreenHeader,
  WebScreenTitle,
  bottomNavBarHeight,
} from '@/components/wheely';
import { WEB_TITLE_CONTENT_SPACING } from '@/components/wheely/web-screen-header';
import { HapticPressable, SectionTitle } from '@/components/wheely/primitives';
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
import { useResolvedTempUnit } from '@/hooks/settings-context';
import { useWheelyColors } from '@/hooks/use-theme';
import type { TempUnit } from '@/utils/temperature';
import type { Weather } from '@/types/weather';
import { contentColumnStyle, screenGutterStyle } from '@/components/wheely/content-column';
import { Spacing, TRANSPARENT, type WheelyPalette } from '@/constants/theme';

const isWeb = Platform.OS === 'web';

// Web tab switches remount this screen, so play the entrance stagger only on
// the first home mount per session; native tabs keep the screen mounted.
let hasPlayedWebEntrance = false;

function Stagger({ order, children }: Readonly<{ order: number; children: ReactNode }>) {
  const reduceMotion = useReducedMotion();
  const [skipEntrance] = useState(() => isWeb && hasPlayedWebEntrance);
  useEffect(() => {
    hasPlayedWebEntrance = true;
  }, []);
  const entering =
    reduceMotion || skipEntrance ? undefined : FadeInDown.duration(380).delay(order * 70);
  return <Animated.View entering={entering}>{children}</Animated.View>;
}

function deriveHomeState(
  weather: Weather,
  location: string,
  acclimatization: AcclimatizationContext,
  tempUnit: TempUnit,
) {
  const { thresholds, homeBaseline } = acclimatization;
  const status = getOverallStatus(weather, thresholds);
  return {
    status,
    message: getMessage(weather, status, thresholds, tempUnit),
    label: getVerdictLabel(status, location),
    acclimatizationNote: getAcclimatizationNote(weather, homeBaseline),
    rainTiming: getRainTiming(weather.hourly),
    daylightWarning: getDaylightWarning(weather.hourly, weather.daylight),
    alerts: getWeatherAlerts(weather, tempUnit),
  };
}

type HomeState = ReturnType<typeof deriveHomeState>;

function WebCityHeading({ city }: Readonly<{ city: string }>) {
  const router = useRouter();
  if (!isWeb || city.length === 0) return null;
  return (
    <WebScreenHeader
      variant="title"
      withScreenGutter={false}
      title={
        <HapticPressable
          onPress={() => {
            router.navigate('/location');
          }}
          accessibilityRole="button"
          accessibilityLabel={`Location: ${city}. Change location`}
          style={({ pressed }) => [pressed && { opacity: 0.7 }]}
        >
          <WebScreenTitle>{city}</WebScreenTitle>
        </HapticPressable>
      }
    />
  );
}

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
  const [locating, setLocating] = useState(false);

  const weather = forecast.snapshot?.weather ?? null;
  const location = forecast.snapshot?.location ?? '';
  const city = location.split(',')[0]?.trim() ?? '';
  const acclimatization = forecast.snapshot?.acclimatization ?? null;
  const tempUnit = useResolvedTempUnit();
  // Bundle the non-null trio so rendering needs a single presence check.
  const sections = useMemo(
    () =>
      weather && acclimatization
        ? {
            weather,
            thresholds: acclimatization.thresholds,
            derived: deriveHomeState(weather, location, acclimatization, tempUnit),
          }
        : null,
    [weather, location, acclimatization, tempUnit],
  );

  const c = useWheelyColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const bottomNavInset = isWeb ? bottomNavBarHeight(insets.bottom) : undefined;

  const title = city
    ? `${city} Ride Forecast — Wheely Weather`
    : 'Wheely Weather — Ride forecast for cyclists';
  const desc = city
    ? `Hourly weather scoring and kit guide for cycling in ${city}.`
    : "Scores how good today's weather is for a bike ride — hourly forecast, kit guide, and a plain-language ride verdict.";

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={desc} />
      </Head>
      <HomeContent
        forecast={forecast}
        sections={sections}
        city={city}
        locating={locating}
        setLocating={setLocating}
        router={router}
        styles={styles}
        bottomNavInset={bottomNavInset}
      />
    </>
  );
}

function HomeContent({
  forecast,
  sections,
  city,
  locating,
  setLocating,
  router,
  styles,
  bottomNavInset,
}: Readonly<{
  forecast: ReturnType<typeof useForecast>;
  sections: {
    weather: Weather;
    thresholds: AcclimatizationContext['thresholds'];
    derived: HomeState;
  } | null;
  city: string;
  locating: boolean;
  setLocating: (val: boolean) => void;
  router: ReturnType<typeof useRouter>;
  styles: ReturnType<typeof makeStyles>;
  bottomNavInset?: number;
}>) {
  if (forecast.loading) {
    return <LoadingState />;
  }
  // Only surface a full-page error when there is no content to show; with a
  // (possibly cached) snapshot on screen, a failed refresh keeps the content.
  if (forecast.errorKind && !forecast.snapshot) {
    return <ErrorState kind={forecast.errorKind} onRetry={forecast.refresh} />;
  }

  if (forecast.needsLocation) {
    return (
      <View style={styles.screen}>
        <LocationPromptState
          busy={locating}
          statusMessage={forecast.statusMessage}
          onUseDeviceLocation={() => {
            setLocating(true);
            void forecast.useDeviceLocation().finally(() => {
              setLocating(false);
            });
          }}
          onChooseLocation={() => {
            router.navigate('/location');
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
          <WebCityHeading city={city} />
          <View style={styles.content}>
            {forecast.errorKind && sections && (
              <StaleDataNotice kind={forecast.errorKind} onRetry={forecast.refresh} />
            )}
            {headerContent !== null && <Stagger order={0}>{headerContent}</Stagger>}
            {sections && (
              <HomeSections
                weather={sections.weather}
                derived={sections.derived}
                thresholds={sections.thresholds}
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
      paddingTop: 0,
      paddingBottom: Spacing.three,
    },
    content: {
      ...contentColumnStyle,
      marginTop: Platform.OS === 'web' ? WEB_TITLE_CONTENT_SPACING : 0,
      gap: 36,
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
