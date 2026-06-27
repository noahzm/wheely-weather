import { useMemo, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Sunrise, Umbrella } from 'lucide-react-native';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Stack, useRouter } from 'expo-router';
import { GlassView } from 'expo-glass-effect';

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
  WeatherHeader,
} from '@/components/wheely';
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
import {
  Fonts,
  MaxContentWidth,
  Spacing,
  TRANSPARENT,
  type WheelyPalette,
} from '@/constants/theme';

function Stagger({ order, children }: Readonly<{ order: number; children: ReactNode }>) {
  return (
    <Animated.View entering={FadeInDown.duration(380).delay(order * 70)}>{children}</Animated.View>
  );
}

function NavSearchButton() {
  const router = useRouter();
  const c = useWheelyColors();
  return (
    <Pressable
      onPress={() => {
        router.push('/location');
      }}
      accessibilityRole="button"
      accessibilityLabel="Search location"
      style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
    >
      <SymbolView name="map.fill" size={17} type="hierarchical" tintColor={c.ink} />
    </Pressable>
  );
}

function NavLocationTitle() {
  const forecast = useForecast();
  const c = useWheelyColors();
  return (
    <GlassView glassEffectStyle="regular" style={{ borderRadius: 22 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          paddingHorizontal: Spacing.three,
          paddingVertical: Spacing.two,
        }}
      >
        {forecast.savedLocation?.source === 'device' && (
          <SymbolView name="location.fill" size={13} tintColor={c.ink} />
        )}
        <Text style={{ fontFamily: Fonts.monoBold, fontSize: 16, color: c.ink }}>
          {forecast.snapshot?.location ?? 'Set location'}
        </Text>
      </View>
    </GlassView>
  );
}

function NavSettingsButton() {
  const router = useRouter();
  const c = useWheelyColors();
  return (
    <Pressable
      onPress={() => {
        router.push('/settings');
      }}
      accessibilityRole="button"
      accessibilityLabel="Settings"
      style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
    >
      <SymbolView name="gearshape.fill" size={18} tintColor={c.ink} />
    </Pressable>
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

function HourlyNoteChip({ icon, text }: Readonly<{ icon: SFSymbol; text: string }>) {
  const c = useWheelyColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const FallbackIcon = icon === 'umbrella.fill' ? Umbrella : Sunrise;
  return (
    <View style={styles.noteChip}>
      {Platform.OS === 'ios' ? (
        <SymbolView name={icon} size={13} tintColor={c.ink} />
      ) : (
        <FallbackIcon size={13} color={c.ink} strokeWidth={2.5} />
      )}
      <ThemedText style={styles.noteChipText}>{text}</ThemedText>
    </View>
  );
}

function HomeSections({ weather, derived }: Readonly<{ weather: Weather; derived: HomeState }>) {
  const c = useWheelyColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const hasNotes = !!derived.rainTiming || !!derived.daylightWarning;

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
          {hasNotes && (
            <View style={styles.inlineNotes}>
              {!!derived.rainTiming && (
                <HourlyNoteChip icon="umbrella.fill" text={derived.rainTiming} />
              )}
              {!!derived.daylightWarning && (
                <HourlyNoteChip icon="sunrise.fill" text={derived.daylightWarning} />
              )}
            </View>
          )}
          <HourlyForecast hourly={weather.hourly} pastHourly={weather.pastHourly} />
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
  const router = useRouter();

  if (forecast.loading) return <LoadingState />;
  if (forecast.errorKind)
    return <ErrorState kind={forecast.errorKind} onRetry={forecast.refresh} />;

  let headerContent: ReactNode = null;
  if (Platform.OS !== 'ios') {
    headerContent = (
      <WeatherHeader
        location={location}
        statusMessage={forecast.statusMessage}
        onOpenLocation={() => {
          router.push('/location');
        }}
      />
    );
  } else if (forecast.statusMessage) {
    headerContent = <ThemedText style={styles.statusMessage}>{forecast.statusMessage}</ThemedText>;
  }

  return (
    <View style={styles.screen}>
      {Platform.OS === 'ios' && (
        <Stack.Screen
          options={{
            headerShown: true,
            headerTransparent: true,
            headerLeft: () => <NavSearchButton />,
            headerTitle: () => <NavLocationTitle />,
            headerRight: () => <NavSettingsButton />,
          }}
        />
      )}

      <ScrollView
        style={styles.scroll}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl refreshing={forecast.refreshing} onRefresh={forecast.refresh} />
        }
        contentContainerStyle={styles.scrollContent}
      >
        <SafeAreaView
          style={styles.safeArea}
          edges={Platform.OS === 'ios' ? ['bottom'] : undefined}
        >
          <View style={styles.content}>
            <Stagger order={0}>{headerContent}</Stagger>
            {weather && derived && <HomeSections weather={weather} derived={derived} />}
          </View>
        </SafeAreaView>
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
    scrollContent: {
      flexGrow: 1,
    },
    safeArea: {
      flex: 1,
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
    inlineNotes: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.two,
    },
    noteChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.one,
      alignSelf: 'flex-start',
      borderWidth: 2,
      borderColor: c.ink,
      backgroundColor: c.paper,
      paddingHorizontal: Spacing.two,
      paddingVertical: Spacing.one,
    },
    noteChipText: {
      color: c.ink,
      fontWeight: '400',
      fontSize: 12,
    },
    statusMessage: {
      color: c.mutedInk,
      textAlign: 'center',
      fontSize: 13,
    },
  });
}
