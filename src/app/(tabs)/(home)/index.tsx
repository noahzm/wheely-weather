import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { Navigation } from 'lucide-react-native';

import {
  CurrentLocationBadge,
  DailyForecast,
  ErrorState,
  HourlyForecast,
  KitGuide,
  LoadingState,
  LocationPromptState,
  PinnedLocationsBar,
  RideSpecs,
  RideVerdict,
  StaleDataNotice,
  WeatherAlerts,
  WebScreenHeader,
  WebScreenTitle,
  bottomNavBarHeight,
} from '@/components/wheely';
import { WEB_TITLE_CONTENT_SPACING } from '@/components/wheely/web-screen-header';
import { HapticPressable, PlatformIcon, SectionTitle } from '@/components/wheely/primitives';
import { ThemedText } from '@/components/themed-text';
import {
  calculateRideScore,
  getDaylightWarning,
  getMessage,
  getOverallStatus,
  getRainTiming,
  getWeatherAlerts,
  getVerdictLabel,
} from '@/domain';
import type { AcclimatizationContext } from '@/services/forecastSnapshot';
import { useForecast } from '@/hooks/forecast-context';
import { useGearMode, useResolvedTempUnit } from '@/hooks/settings-context';
import { useWheelyColors } from '@/hooks/use-theme';
import { GearStylePicker } from '@/components/wheely/gear-style-picker';
import { cityFromLocation } from '@/utils/locationTitle';
import { formatUpdatedAgo } from '@/utils/timeFormat';
import type { TempUnit } from '@/utils/temperature';
import type { Weather } from '@/types/weather';
import { contentColumnStyle, screenGutterStyle } from '@/components/wheely/content-column';
import { Spacing, TRANSPARENT, Type, type WheelyPalette } from '@/constants/theme';

const isWeb = Platform.OS === 'web';
const isIOS = Platform.OS === 'ios';

// Web tab switches remount this screen, so play the entrance stagger only on
// the first home mount per session; native tabs keep the screen mounted.
let hasPlayedWebEntrance = false;

// Color-free, so it lives outside the palette-driven `makeStyles`.
const headingStyles = StyleSheet.create({
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});

const STAGGER_STEP_MS = 70;
const STAGGER_DURATION_MS = 380;
const STAGGER_RISE = 12;

/**
 * Staggered entrance for each home section.
 *
 * Driven by a shared value rather than reanimated's `entering` prop: layout
 * entering animations are fire-and-forget, so an interruption (a snapshot
 * re-render as the cache hydrates and the live fetch lands, or a tab
 * transition) strands the view at a partial opacity. That washes out the whole
 * card subtree uniformly — border, text, icons, and chart colors alike — and it
 * hits later sections hardest because their delay is longest. A value that is
 * always driven toward 1 settles no matter how often the tree re-renders.
 */
function Stagger({ order, children }: Readonly<{ order: number; children: ReactNode }>) {
  const reduceMotion = useReducedMotion();
  const [skipEntrance] = useState(() => isWeb && hasPlayedWebEntrance);
  const animate = !reduceMotion && !skipEntrance;
  const progress = useSharedValue(animate ? 0 : 1);

  useEffect(() => {
    hasPlayedWebEntrance = true;
  }, []);

  useEffect(() => {
    if (!animate) {
      progress.value = 1;
      return;
    }
    progress.value = withDelay(
      order * STAGGER_STEP_MS,
      withTiming(1, { duration: STAGGER_DURATION_MS }),
    );
  }, [animate, order, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * STAGGER_RISE }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}

function deriveHomeState(
  weather: Weather,
  location: string,
  acclimatization: AcclimatizationContext,
  tempUnit: TempUnit,
) {
  const { thresholds } = acclimatization;
  const status = getOverallStatus(weather, thresholds);
  const score = calculateRideScore(weather, thresholds);
  return {
    status,
    score,
    message: getMessage(weather, status, thresholds, tempUnit),
    label: getVerdictLabel(status, location),
    rainTiming: getRainTiming(weather.hourly),
    daylightWarning: getDaylightWarning(weather.hourly, weather.daylight),
    alerts: getWeatherAlerts(weather, tempUnit),
  };
}

type HomeState = ReturnType<typeof deriveHomeState>;

function WebCityHeading({ city, following }: Readonly<{ city: string; following: boolean }>) {
  const router = useRouter();
  const c = useWheelyColors();
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
          accessibilityLabel={
            following
              ? `Location: ${city}, following your current location. Change location`
              : `Location: ${city}. Change location`
          }
          style={({ pressed }) => [headingStyles.cityRow, pressed && { opacity: 0.7 }]}
        >
          {following && (
            <PlatformIcon icon={Navigation} size={20} color={c.ink} strokeWidth={2.5} />
          )}
          <WebScreenTitle>{city}</WebScreenTitle>
        </HapticPressable>
      }
    />
  );
}

function TodayKitSection({
  weather,
  styles,
}: Readonly<{
  weather: Weather;
  styles: ReturnType<typeof makeStyles>;
}>) {
  const [mode, setMode] = useGearMode();
  return (
    <View style={styles.section}>
      <SectionTitle
        title="Today’s kit"
        rightAccessory={<GearStylePicker mode={mode} onModeChange={setMode} />}
      />
      <KitGuide weather={weather} mode={mode} showPicker={false} />
    </View>
  );
}

function HomeSections({
  weather,
  derived,
  thresholds,
  refreshing = false,
}: Readonly<{
  weather: Weather;
  derived: HomeState;
  thresholds: AcclimatizationContext['thresholds'];
  refreshing?: boolean;
}>) {
  const c = useWheelyColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const reduceMotion = useReducedMotion();
  const sectionsOpacity = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) {
      sectionsOpacity.value = 1;
      return;
    }
    sectionsOpacity.value = withTiming(refreshing ? 0.65 : 1, { duration: 180 });
  }, [refreshing, reduceMotion, sectionsOpacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: sectionsOpacity.value,
  }));

  return (
    <Animated.View style={[styles.sectionsWrap, animatedStyle]}>
      {/* Alerts belong to the verdict, so they group with it and skip the 36px
          rhythm that separates the page's sections. The wrapper carries no gap
          of its own — `RideVerdict`'s own `marginBottom` is the spacing. */}
      <View>
        <Stagger order={1}>
          <RideVerdict
            status={derived.status}
            score={derived.score}
            message={derived.message}
            label={derived.label}
            weatherCode={weather.weatherCode}
          />
        </Stagger>
        {derived.alerts.length > 0 && (
          <Stagger order={2}>
            <WeatherAlerts alerts={derived.alerts} />
          </Stagger>
        )}
      </View>

      <Stagger order={3}>
        <View style={styles.section}>
          <SectionTitle title="Hour by hour" />
          <HourlyForecast
            hourly={weather.hourly}
            pastHourly={weather.pastHourly}
            rainTiming={derived.rainTiming}
            daylightWarning={derived.daylightWarning}
            thresholds={thresholds}
          />
        </View>
      </Stagger>

      <Stagger order={4}>
        <TodayKitSection weather={weather} styles={styles} />
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
    </Animated.View>
  );
}

export default function HomeScreen() {
  const forecast = useForecast();
  const router = useRouter();
  const [locating, setLocating] = useState(false);

  const weather = forecast.snapshot?.weather ?? null;
  const location = forecast.snapshot?.location ?? '';
  const city = cityFromLocation(forecast.savedLocation?.name) || cityFromLocation(location);
  const followingDevice = forecast.savedLocation
    ? forecast.savedLocation.source === 'device'
    : forecast.snapshot?.isDeviceLocation === true;
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
        followingDevice={followingDevice}
        locating={locating}
        setLocating={setLocating}
        router={router}
        styles={styles}
        bottomNavInset={bottomNavInset}
      />
    </>
  );
}

function getUpdatedLabels(snapshot: { lastUpdated: Date } | null, statusMessage: string) {
  const updatedText = snapshot ? formatUpdatedAgo(snapshot.lastUpdated) : '';
  const headerText = statusMessage || (!isIOS && !isWeb ? updatedText : '');
  const webUpdatedText = isWeb && updatedText ? updatedText : null;
  const refreshTitle = isIOS && updatedText ? updatedText : undefined;

  return { headerText, webUpdatedText, refreshTitle };
}

function HomeContent({
  forecast,
  sections,
  city,
  followingDevice,
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
  followingDevice: boolean;
  locating: boolean;
  setLocating: (val: boolean) => void;
  router: ReturnType<typeof useRouter>;
  styles: ReturnType<typeof makeStyles>;
  bottomNavInset?: number;
}>) {
  const c = useWheelyColors();
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

  const { headerText, webUpdatedText, refreshTitle } = getUpdatedLabels(
    forecast.snapshot,
    forecast.statusMessage,
  );
  const headerContent: ReactNode = headerText ? (
    <ThemedText style={styles.statusMessage}>{headerText}</ThemedText>
  ) : null;

  const scrollHostStyle = isWeb ? styles.scrollHost : undefined;

  return (
    <View style={styles.screen} collapsable={false}>
      <ScrollView
        style={[styles.scroll, scrollHostStyle]}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl
            refreshing={forecast.refreshing}
            onRefresh={forecast.refresh}
            title={refreshTitle}
            titleColor={c.mutedInk}
          />
        }
        contentContainerStyle={[
          styles.scrollContent,
          bottomNavInset != null && { paddingBottom: bottomNavInset },
        ]}
      >
        <View style={styles.safeArea}>
          <WebCityHeading city={city} following={followingDevice} />
          <View style={styles.content}>
            {/* Web shows the arrow inline beside its own heading above. Pinned bar already has a Current pill. */}
            {followingDevice && !isWeb && forecast.pinnedLocations.length === 0 && (
              <CurrentLocationBadge />
            )}
            {forecast.pinnedLocations.length > 0 && (
              <PinnedLocationsBar
                pinnedLocations={forecast.pinnedLocations}
                savedLocation={forecast.savedLocation}
                followingDevice={followingDevice}
                onSelectCurrentLocation={() => {
                  void forecast.useDeviceLocation();
                }}
                onSelectPinnedLocation={(place) => {
                  void forecast.setManualLocation(place);
                }}
              />
            )}
            {forecast.errorKind && sections && (
              <StaleDataNotice kind={forecast.errorKind} onRetry={forecast.refresh} />
            )}
            {headerContent !== null && <Stagger order={0}>{headerContent}</Stagger>}
            {sections && (
              <HomeSections
                weather={sections.weather}
                derived={sections.derived}
                thresholds={sections.thresholds}
                refreshing={forecast.refreshing}
              />
            )}
            {webUpdatedText !== null && (
              <Stagger order={7}>
                <ThemedText style={styles.statusMessage}>{webUpdatedText}</ThemedText>
              </Stagger>
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
      // Native: breathing room between the large-title header and the verdict card.
      marginTop: Platform.OS === 'web' ? WEB_TITLE_CONTENT_SPACING : Spacing.three,
      gap: 36,
    },
    sectionsWrap: {
      gap: 36,
    },
    section: {
      gap: Spacing.three,
    },
    statusMessage: {
      color: c.mutedInk,
      textAlign: 'center',
      fontSize: Type.small.fontSize,
    },
  });
}
