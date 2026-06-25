import { useMemo, type ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Sunrise, Umbrella } from 'lucide-react-native';
import { useRouter } from 'expo-router';

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
} from '@/components/wheely-ui';
import { ThemedText } from '@/components/themed-text';
import { getDaylightWarning, getMessage, getOverallStatus, getRainTiming, getWeatherAlerts } from '@/domain';
import { useForecast } from '@/hooks/forecast-context';
import { useWheelyColors } from '@/hooks/use-theme';
import { MaxContentWidth, Spacing, type WheelyPalette } from '@/constants/theme';

function Stagger({ order, children }: { order: number; children: ReactNode }) {
  return (
    <Animated.View entering={FadeInDown.duration(380).delay(order * 70)}>{children}</Animated.View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const forecast = useForecast();

  const weather = forecast.snapshot?.weather ?? null;
  const derived = useMemo(() => {
    if (!weather) return null;
    const status = getOverallStatus(weather) as 'yes' | 'maybe' | 'no';
    const message = getMessage(weather, status);
    return {
      status,
      message,
      rainTiming: getRainTiming(weather.hourly),
      daylightWarning: getDaylightWarning(weather.hourly, weather.daylight),
      alerts: getWeatherAlerts(weather),
    };
  }, [weather]);

  const c = useWheelyColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  if (forecast.loading) return <LoadingState />;
  if (forecast.errorKind) return <ErrorState kind={forecast.errorKind} onRetry={forecast.refresh} />;

  return (
    <View style={styles.screen}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={forecast.refreshing} onRefresh={forecast.refresh} />
        }
        contentContainerStyle={styles.scrollContent}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.content}>
            <Stagger order={0}>
              <WeatherHeader
                location={forecast.snapshot?.location ?? ''}
                lastUpdated={forecast.snapshot?.lastUpdated ?? null}
                isFallbackLocation={!!forecast.snapshot?.isFallbackLocation}
                isManualLocation={!!forecast.snapshot?.isManualLocation}
                isDeviceLocation={!!forecast.snapshot?.isDeviceLocation}
                statusMessage={forecast.statusMessage}
                onOpenLocation={() => router.push('/location')}
              />
            </Stagger>

            {weather && derived && (
              <>
                <Stagger order={1}>
                  <RideVerdict status={derived.status} message={derived.message} />
                </Stagger>
                {derived.alerts.length > 0 && (
                  <Stagger order={2}>
                    <WeatherAlerts alerts={derived.alerts} />
                  </Stagger>
                )}

                <Stagger order={3}>
                  <View style={styles.section}>
                    <SectionTitle index="01" title="Hour by hour" />
                    {(derived.rainTiming || derived.daylightWarning) && (
                      <View style={styles.inlineNotes}>
                        {!!derived.rainTiming && (
                          <View style={styles.noteChip}>
                            <Umbrella size={13} color={c.ink} strokeWidth={2.5} />
                            <ThemedText style={styles.noteChipText}>{derived.rainTiming}</ThemedText>
                          </View>
                        )}
                        {!!derived.daylightWarning && (
                          <View style={styles.noteChip}>
                            <Sunrise size={13} color={c.ink} strokeWidth={2.5} />
                            <ThemedText style={styles.noteChipText}>{derived.daylightWarning}</ThemedText>
                          </View>
                        )}
                      </View>
                    )}
                    <HourlyForecast hourly={weather.hourly} pastHourly={weather.pastHourly} />
                  </View>
                </Stagger>

                <Stagger order={4}>
                  <View style={styles.section}>
                    <SectionTitle index="02" title="Today's kit" />
                    <KitGuide weather={weather} />
                  </View>
                </Stagger>

                <Stagger order={5}>
                  <View style={styles.section}>
                    <SectionTitle index="03" title="The numbers" />
                    <RideSpecs weather={weather} />
                  </View>
                </Stagger>

                <Stagger order={6}>
                  <View style={styles.section}>
                    <SectionTitle index="04" title="The week ahead" />
                    <DailyForecast daily={weather.daily} />
                  </View>
                </Stagger>
              </>
            )}
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
    backgroundColor: c.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.five,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.five,
  },
  section: {
    gap: Spacing.three,
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
    fontWeight: '800',
    fontSize: 12,
  },
  });
}
