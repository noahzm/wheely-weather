import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Stack, useIsFocused, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Head from 'expo-router/head';
import { Navigation } from '@/components/wheely/icons';

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
import { HomeBackdrop, type SceneKind } from '@/components/wheely/home-backdrop';
import { Stagger, useHomeEntrance } from '@/components/wheely/home-entrance';
import {
  WEB_TITLE_CONTENT_SPACING,
  WebCompactTitleBar,
  useWebTitleCollapse,
} from '@/components/wheely/web-screen-header';
import { HapticPressable, PlatformIcon, SectionTitle } from '@/components/wheely/primitives';
import { ThemedText } from '@/components/themed-text';
import {
  getDaylightWarning,
  getRainTiming,
  getRideVerdict,
  getWeatherAlerts,
  getRideKitTitle,
  getRideVerdictLabel,
} from '@/domain';
import { getVerdictSky } from '@/domain/weather-codes';
import type { AcclimatizationContext } from '@/services/forecastSnapshot';
import { useForecast } from '@/hooks/forecast-context';
import { useGearMode, useResolvedTempUnit } from '@/hooks/settings-context';
import { useLargeTitleScrollToTop } from '@/hooks/use-large-title-scroll-to-top';
import { useMinimumRefreshing } from '@/hooks/use-minimum-refreshing';
import { useColorSchemeName, useWheelyColors } from '@/hooks/use-theme';
import { GearStylePicker } from '@/components/wheely/gear-style-picker';
import { HourlyNoteStickers } from '@/components/wheely/hourly-note-stickers';
import { cityFromLocation } from '@/utils/locationTitle';
import { formatUpdatedAgo } from '@/utils/timeFormat';
import type { TempUnit } from '@/utils/temperature';
import type { RideDuration } from '@/types/settings';
import type { Weather } from '@/types/weather';
import { contentColumnStyle, screenGutterStyle } from '@/components/wheely/content-column';
import { SceneColors, Spacing, TRANSPARENT, Type, type WheelyPalette } from '@/constants/theme';
import { isSkyUnderStatusBar } from '@/utils/homeScene';
import { largeTitleStyle } from '@/utils/large-title-stack-options';

const isWeb = Platform.OS === 'web';
const isIOS = Platform.OS === 'ios';
const PLACE_FADE_MS = 260;

/**
 * Web has no navigation bar over its title, so while the scene shows, this
 * much sky above the heading gives the sun and clouds room, as native's bar does.
 */
const WEB_SKY_ROOM = Spacing.six;

// Color-free, so it lives outside the palette-driven `makeStyles`.
const headingStyles = StyleSheet.create({
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    maxWidth: '100%',
  },
  heading: {
    alignSelf: 'stretch',
  },
  skyRoom: {
    paddingTop: WEB_SKY_ROOM,
  },
});

// Home spacing system: 16 (Spacing.three) from any title to its card's edge —
// stickers and pills that straddle that edge rise into the gap rather than
// pushing the card down — and SECTION_GAP between sections, measured from the
// card edge. Not tighter: the
// stamps that hang off a card's bottom (the hourly "Poor" burst) need room
// above the next title.
const SECTION_GAP = 28;

function deriveHomeState(
  weather: Weather,
  location: string,
  acclimatization: AcclimatizationContext,
  tempUnit: TempUnit,
  rideDuration?: RideDuration,
) {
  const { thresholds } = acclimatization;
  // Rates the day's best ride window (tomorrow's after dark), not this hour.
  const verdict = getRideVerdict(weather, thresholds, tempUnit);
  const windowWithDay = verdict.window
    ? { ...verdict.window, tomorrow: verdict.when === 'tomorrow' }
    : null;
  return {
    status: verdict.status,
    condition: verdict.condition,
    score: verdict.score,
    message: verdict.message,
    label: getRideVerdictLabel(verdict, location),
    verdictWeatherCode: verdict.weatherCode,
    waiting: verdict.when === 'wait',
    // Shaded on the chart when it's a recommendation; the best of a no-go day isn't.
    rideWindow: verdict.status === 'no' ? null : windowWithDay,
    // Dress for the window the verdict rates, not the current hour.
    kit: {
      title: getRideKitTitle(verdict),
      weather: verdict.rated,
      rideHours: windowWithDay,
      thresholds,
      rideDuration,
    },
    rainTiming: getRainTiming(weather.hourly),
    daylightWarning: getDaylightWarning(weather.hourly, weather.daylight),
    alerts: getWeatherAlerts(weather, tempUnit),
  };
}

type HomeState = ReturnType<typeof deriveHomeState>;

interface HomeSectionsData {
  weather: Weather;
  thresholds: AcclimatizationContext['thresholds'];
  derived: HomeState;
}

/**
 * Lines the home backdrop up with the page. `offset` is how far the web city
 * heading pushes the content column below where native starts it (native
 * draws the title in its large-title bar instead), so the scene can sit under
 * the heading; always 0 on native. `groundTop` is where the verdict card's
 * block starts in the scroll content, so the hills stay below whatever sits
 * above the card (the location line, the pinned places, the web title); null
 * until it has been laid out.
 */
function useSceneLayout() {
  const [contentTop, setContentTop] = useState(0);
  const [sectionsTop, setSectionsTop] = useState<number | null>(null);
  return {
    offset: isWeb ? Math.max(0, contentTop - Spacing.three) : 0,
    groundTop: sectionsTop == null ? null : contentTop + sectionsTop,
    onContentLayout: (event: LayoutChangeEvent) => {
      setContentTop(event.nativeEvent.layout.y);
    },
    onSectionsLayout: (event: LayoutChangeEvent) => {
      setSectionsTop(event.nativeEvent.layout.y);
    },
  };
}

function WebCityHeading({
  city,
  following,
  onScene = false,
}: Readonly<{ city: string; following: boolean; onScene?: boolean }>) {
  const router = useRouter();
  const c = useWheelyColors();
  if (!isWeb || city.length === 0) return null;
  const ink = onScene ? SceneColors.ink : c.ink;
  return (
    <View style={[headingStyles.heading, onScene && headingStyles.skyRoom]}>
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
            <WebScreenTitle color={ink}>{city}</WebScreenTitle>
            {following && <PlatformIcon icon={Navigation} size={20} color={ink} filled />}
          </HapticPressable>
        }
      />
    </View>
  );
}

/**
 * What the native chrome needs while the home scene shows: its sky is
 * daylight in both color schemes, so the large title over it takes dark ink,
 * and so does the status bar while the sky is behind it. Once the page
 * scrolls under the blurred navigation bar, the status bar goes back to the
 * scheme's own style, and it is only touched while Home is the focused tab.
 */
function HomeSceneChrome({
  onScene,
  skyUnderStatusBar,
}: Readonly<{ onScene: boolean; skyUnderStatusBar: boolean }>) {
  const isFocused = useIsFocused();
  const dark = useColorSchemeName() === 'dark';
  if (!isIOS) return null;
  return (
    <>
      <Stack.Screen
        options={{ headerLargeTitleStyle: largeTitleStyle(onScene ? SceneColors.ink : undefined) }}
      />
      {onScene && dark && isFocused && skyUnderStatusBar && <StatusBar style="dark" />}
    </>
  );
}

/** Tracks whether the scene's sky is behind the status bar as the page scrolls (iOS). */
function useSkyUnderStatusBar() {
  const insets = useSafeAreaInsets();
  const [skyUnder, setSkyUnder] = useState(true);
  const onScroll = isIOS
    ? (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        setSkyUnder(isSkyUnderStatusBar(event.nativeEvent.contentOffset.y, insets.top));
      }
    : undefined;
  return { skyUnder, onScroll };
}

function KitSection({
  kit,
  styles,
}: Readonly<{
  kit: HomeState['kit'];
  styles: ReturnType<typeof makeStyles>;
}>) {
  const [mode, setMode] = useGearMode();
  return (
    <View style={styles.section}>
      <SectionTitle
        title={kit.title}
        rightAccessory={<GearStylePicker mode={mode} onModeChange={setMode} />}
      />
      <KitGuide
        weather={kit.weather}
        rideHours={kit.rideHours}
        thresholds={kit.thresholds}
        mode={mode}
        rideDuration={kit.rideDuration}
      />
    </View>
  );
}

function HomeSections({
  weather,
  derived,
  thresholds,
  refreshing = false,
  placeKey,
}: Readonly<{
  weather: Weather;
  derived: HomeState;
  thresholds: AcclimatizationContext['thresholds'];
  refreshing?: boolean;
  /** The place the forecast is for; a change fades the new place's sections in. */
  placeKey: string;
}>) {
  const c = useWheelyColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const reduceMotion = useReducedMotion();
  const entrance = useHomeEntrance();
  const sectionsOpacity = useSharedValue(1);
  const [shownPlace, setShownPlace] = useState(placeKey);

  // Switching places swaps every section at once, so fade the new forecast in.
  if (shownPlace !== placeKey) {
    setShownPlace(placeKey);
    if (!reduceMotion) {
      sectionsOpacity.set(0);
      sectionsOpacity.set(withTiming(1, { duration: PLACE_FADE_MS }));
    }
  }

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
      {/* Alerts belong to the verdict, so they group with it and skip the
          rhythm that separates the page's sections: a tighter margin of their own. */}
      <View>
        <Stagger order={1} variant="slap">
          <RideVerdict
            status={derived.status}
            score={derived.score}
            message={derived.message}
            label={derived.label}
            waiting={derived.waiting}
            condition={derived.condition}
            entrance={entrance}
          />
        </Stagger>
        {derived.alerts.length > 0 && (
          <Stagger order={2}>
            <View style={styles.alerts}>
              <WeatherAlerts alerts={derived.alerts} />
            </View>
          </Stagger>
        )}
      </View>

      <Stagger order={3}>
        <View style={styles.section}>
          {/* The notes ride in the title row (like the kit's style picker) and
              straddle the card's top edge, so they don't push the card down. */}
          <View style={styles.overlappingTitle}>
            <SectionTitle
              title="Hour by hour"
              rightAccessory={
                weather.hourly.length > 0 ? (
                  <HourlyNoteStickers
                    rainTiming={derived.rainTiming}
                    daylightWarning={derived.daylightWarning}
                  />
                ) : null
              }
            />
          </View>
          <HourlyForecast
            hourly={weather.hourly}
            pastHourly={weather.pastHourly}
            thresholds={thresholds}
            rideWindow={derived.rideWindow}
          />
        </View>
      </Stagger>

      <Stagger order={4}>
        <KitSection kit={derived.kit} styles={styles} />
      </Stagger>

      <Stagger order={5}>
        <View style={styles.section}>
          <SectionTitle title="Right now" />
          <RideSpecs weather={weather} thresholds={thresholds} />
        </View>
      </Stagger>

      <Stagger order={6}>
        <View style={styles.section}>
          <SectionTitle title="The week ahead" />
          <DailyForecast daily={weather.daily} thresholds={thresholds} />
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
  const snapshotRideDuration = forecast.snapshot?.rideDuration;
  const tempUnit = useResolvedTempUnit();
  // Bundle the non-null trio so rendering needs a single presence check.
  const sections = useMemo(
    () =>
      weather && acclimatization
        ? {
            weather,
            thresholds: acclimatization.thresholds,
            derived: deriveHomeState(
              weather,
              location,
              acclimatization,
              tempUnit,
              snapshotRideDuration,
            ),
          }
        : null,
    [weather, location, acclimatization, tempUnit, snapshotRideDuration],
  );

  const c = useWheelyColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const bottomNavInset = isWeb ? bottomNavBarHeight(insets.bottom) : Spacing.five;
  const sky = useSkyUnderStatusBar();
  // The scene shows only with the forecast itself, not error or location states;
  // on iOS a cold load keeps the bare fair-day launch sky until the forecast lands.
  const showLaunchSky = isIOS && forecast.loading;
  const scene =
    sections && !forecast.loading && !forecast.needsLocation
      ? getVerdictSky(
          sections.derived.status,
          sections.derived.waiting,
          sections.derived.verdictWeatherCode,
        )
      : null;

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
      <HomeSceneChrome onScene={scene != null || showLaunchSky} skyUnderStatusBar={sky.skyUnder} />
      <HomeContent
        forecast={forecast}
        sections={sections}
        scene={scene}
        onScroll={sky.onScroll}
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

function HomeLocationPromptScreen({
  locating,
  setLocating,
  forecast,
  router,
  screenStyle,
  styles,
  bottomNavInset,
}: Readonly<{
  locating: boolean;
  setLocating: (val: boolean) => void;
  forecast: ReturnType<typeof useForecast>;
  router: ReturnType<typeof useRouter>;
  screenStyle: object;
  styles: ReturnType<typeof makeStyles>;
  bottomNavInset?: number;
}>) {
  const scrollHostStyle = isWeb ? styles.scrollHost : undefined;
  return (
    <View style={screenStyle}>
      <ScrollView
        style={[styles.scroll, scrollHostStyle]}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.scrollContent,
          bottomNavInset != null && { paddingBottom: bottomNavInset },
        ]}
      >
        <View style={styles.safeArea}>
          <WebCityHeading city="" following={false} />
          <View style={styles.content}>
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
        </View>
      </ScrollView>
    </View>
  );
}

function homeRefreshControl({
  refreshing,
  onRefresh,
  title,
  c,
}: Readonly<{ refreshing: boolean; onRefresh: () => void; title?: string; c: WheelyPalette }>) {
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      title={title}
      titleColor={c.mutedInk}
      colors={[c.primary, c.accent]}
      progressBackgroundColor={c.paper}
    />
  );
}

/** The place line over the verdict: the pinned places bar, or the current-location line. */
function HomePlaceRow({
  forecast,
  followingDevice,
  onScene,
}: Readonly<{
  forecast: ReturnType<typeof useForecast>;
  followingDevice: boolean;
  onScene: boolean;
}>) {
  if (forecast.pinnedLocations.length > 0) {
    return (
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
    );
  }
  // Web shows the arrow inline beside its own heading; the pinned bar has its own Current pill.
  if (followingDevice && !isWeb) return <CurrentLocationBadge onScene={onScene} />;
  return null;
}

function HomeLoadingScreen({ styles }: Readonly<{ styles: ReturnType<typeof makeStyles> }>) {
  if (!isIOS) return <LoadingState />;
  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentInsetAdjustmentBehavior="automatic"
        scrollEnabled={false}
        contentContainerStyle={styles.scrollContent}
      >
        <HomeBackdrop kind="clear" groundTop={null} bare />
        <LoadingState />
      </ScrollView>
    </View>
  );
}

function HomeContent({
  forecast,
  sections,
  scene,
  onScroll,
  city,
  followingDevice,
  locating,
  setLocating,
  router,
  styles,
  bottomNavInset,
}: Readonly<{
  forecast: ReturnType<typeof useForecast>;
  sections: HomeSectionsData | null;
  scene: SceneKind | null;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  city: string;
  followingDevice: boolean;
  locating: boolean;
  setLocating: (val: boolean) => void;
  router: ReturnType<typeof useRouter>;
  styles: ReturnType<typeof makeStyles>;
  bottomNavInset?: number;
}>) {
  const c = useWheelyColors();
  const showRefreshing = useMinimumRefreshing(forecast.refreshing);
  const scrollRef = useRef<ScrollViewInstance>(null);
  // A repeat Weather tab tap scrolls past the collapsed title's edge to reopen it.
  const scrollProps = useLargeTitleScrollToTop(scrollRef, showRefreshing, onScroll);
  const titleCollapsed = useWebTitleCollapse(scene ? WEB_SKY_ROOM : 0);
  const sceneLayout = useSceneLayout();
  if (forecast.loading) {
    return <HomeLoadingScreen styles={styles} />;
  }
  // Only surface a full-page error when there is no content to show; with a
  // (possibly cached) snapshot on screen, a failed refresh keeps the content.
  if (forecast.errorKind && !forecast.snapshot) {
    return <ErrorState kind={forecast.errorKind} onRetry={forecast.refresh} />;
  }

  if (forecast.needsLocation) {
    return (
      <HomeLocationPromptScreen
        locating={locating}
        setLocating={setLocating}
        forecast={forecast}
        router={router}
        screenStyle={styles.screen}
        styles={styles}
        bottomNavInset={bottomNavInset}
      />
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
        ref={scrollRef}
        style={[styles.scroll, scrollHostStyle]}
        contentInsetAdjustmentBehavior="automatic"
        {...scrollProps}
        refreshControl={homeRefreshControl({
          refreshing: showRefreshing,
          onRefresh: forecast.refresh,
          title: refreshTitle,
          c,
        })}
        contentContainerStyle={[
          styles.scrollContent,
          bottomNavInset != null && { paddingBottom: bottomNavInset },
        ]}
      >
        {scene && (
          <HomeBackdrop
            kind={scene}
            offset={sceneLayout.offset}
            groundTop={sceneLayout.groundTop}
          />
        )}
        <View style={styles.safeArea}>
          <WebCityHeading city={city} following={followingDevice} onScene={scene != null} />
          <View style={styles.content} onLayout={sceneLayout.onContentLayout}>
            <HomePlaceRow
              forecast={forecast}
              followingDevice={followingDevice}
              onScene={scene != null}
            />
            {forecast.errorKind && sections && (
              <StaleDataNotice kind={forecast.errorKind} onRetry={forecast.refresh} />
            )}
            {headerContent !== null && <Stagger order={0}>{headerContent}</Stagger>}
            {sections && (
              <View onLayout={sceneLayout.onSectionsLayout}>
                <HomeSections
                  weather={sections.weather}
                  derived={sections.derived}
                  thresholds={sections.thresholds}
                  refreshing={forecast.refreshing}
                  placeKey={`${forecast.snapshot?.mockScenario ?? ''}|${forecast.snapshot?.location ?? ''}`}
                />
              </View>
            )}
            {webUpdatedText !== null && (
              <Stagger order={7}>
                <ThemedText style={styles.statusMessage}>{webUpdatedText}</ThemedText>
              </Stagger>
            )}
          </View>
        </View>
      </ScrollView>
      {isWeb && city.length > 0 && <WebCompactTitleBar title={city} visible={titleCollapsed} />}
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
      // Title-to-content spacing, same as a section title to its card: the
      // verdict reserves its star pill's overhang, so this lands on the pill.
      gap: Spacing.three,
    },
    sectionsWrap: {
      gap: SECTION_GAP,
    },
    alerts: {
      marginTop: Spacing.three,
    },
    section: {
      gap: Spacing.three,
    },
    // Paints the title row's straddling accessory above the card that follows it.
    overlappingTitle: {
      zIndex: 1,
    },
    statusMessage: {
      color: c.mutedInk,
      textAlign: 'center',
      ...Type.small,
    },
  });
}
