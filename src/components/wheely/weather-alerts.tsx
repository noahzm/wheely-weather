import { useMemo, useId, useState } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Defs, Pattern, Polygon, Rect } from 'react-native-svg';
import { AlertTriangle, ChevronDown, Thermometer, type LucideIcon } from 'lucide-react-native';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { useWheelyColors } from '@/hooks/use-theme';
import { Fonts, FontWeightBold, Spacing, type WheelyPalette } from '@/constants/theme';
import type { WeatherAlert } from '@/types/weather';
import { AnimatedExpand, useExpandAnimation } from './animated-expand';
import { BrutalCard, ButtonRadius, formatTime, HapticPressable } from './primitives';

const EXTREME_ALERT_BG = 'rgba(255,100,44,0.16)';

function makeStyles(c: WheelyPalette) {
  return StyleSheet.create({
    alertStack: { gap: Spacing.three },
    alertCard: { padding: 0 },
    alertBody: {
      flexDirection: 'row',
      gap: Spacing.three,
      padding: Spacing.three,
    },
    alertExtremeBody: { backgroundColor: EXTREME_ALERT_BG },
    alertContent: {
      paddingHorizontal: Spacing.three,
      paddingBottom: Spacing.three,
      gap: Spacing.one,
    },
    alertTextWrap: { flex: 1, gap: Spacing.one },
    alertTitle: {
      color: c.ink,
      fontFamily: Fonts.display,
      fontWeight: FontWeightBold,
      fontSize: 16,
      lineHeight: 20,
    },
    muted: {
      color: c.mutedInk,
      fontSize: 13,
      lineHeight: 18,
    },
    chevronWrap: Platform.select({
      ios: {
        alignSelf: 'flex-start',
        marginTop: 3,
        width: 14,
        height: 14,
        alignItems: 'center',
        justifyContent: 'center',
      },
      default: {
        alignSelf: 'flex-start',
        marginTop: 1,
        width: 18,
        height: 18,
        alignItems: 'center',
        justifyContent: 'center',
      },
    }),
  });
}

function useStyles() {
  const c = useWheelyColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return { c, styles };
}

function HazardStripe({ extreme }: Readonly<{ extreme?: boolean }>) {
  const c = useWheelyColors();
  const patternId = useId();
  const stripe = extreme ? c.error : c.warning;
  return (
    <>
      <View>
        <Svg width="100%" height={10}>
          <Defs>
            <Pattern id={patternId} patternUnits="userSpaceOnUse" width={20} height={20}>
              <Rect width={20} height={20} fill={stripe} />
              <Polygon points="0,0 10,0 20,10 20,20" fill={c.shadow} />
              <Polygon points="0,10 0,20 10,20" fill={c.shadow} />
            </Pattern>
          </Defs>
          <Rect width="100%" height={10} fill={`url(#${patternId})`} />
        </Svg>
      </View>
      <View style={{ height: 2, backgroundColor: c.shadow }} />
    </>
  );
}

function AlertLeadingIcon({
  sfIcon,
  Icon,
  color,
}: Readonly<{ sfIcon: SFSymbol; Icon: LucideIcon; color: string }>) {
  return Platform.OS === 'ios' ? (
    <SymbolView name={sfIcon} size={20} tintColor={color} />
  ) : (
    <Icon size={20} color={color} strokeWidth={2} />
  );
}

function AlertChevron({
  openProgress,
  color,
  style,
}: Readonly<{ openProgress: SharedValue<number>; color: string; style: ViewStyle }>) {
  const animatedStyle = useAnimatedStyle(
    () => ({
      transform: [{ rotate: `${openProgress.value * 180}deg` }],
    }),
    [openProgress],
  );

  return (
    <Animated.View style={[style, animatedStyle]}>
      {Platform.OS === 'ios' ? (
        <SymbolView name="chevron.down" size={14} tintColor={color} />
      ) : (
        <ChevronDown size={18} color={color} />
      )}
    </Animated.View>
  );
}

function AlertCard({ alert }: Readonly<{ alert: WeatherAlert }>) {
  const { c, styles } = useStyles();
  const [open, setOpen] = useState(false);
  const openProgress = useExpandAnimation(open);
  const extreme = alert.severity === 'extreme';
  const isNws = alert.type === 'nws';
  const Icon = alert.icon === 'thermometer' ? Thermometer : AlertTriangle;
  const sfIcon =
    alert.icon === 'thermometer' ? 'thermometer.medium' : 'exclamationmark.triangle.fill';
  const hasDetails = isNws && (!!alert.instruction || !!alert.expires);

  return (
    <BrutalCard small style={styles.alertCard}>
      <View style={{ borderRadius: ButtonRadius - 2, overflow: 'hidden' }}>
        <HazardStripe extreme={extreme} />
        <HapticPressable
          disabled={!hasDetails}
          onPress={() => {
            setOpen((prev) => !prev);
          }}
          accessibilityRole={hasDetails ? 'button' : undefined}
          accessibilityState={hasDetails ? { expanded: open } : undefined}
          style={[styles.alertBody, extreme && styles.alertExtremeBody]}
        >
          <AlertLeadingIcon sfIcon={sfIcon} Icon={Icon} color={c.ink} />
          <View style={styles.alertTextWrap}>
            <ThemedText style={styles.alertTitle}>{alert.event ?? alert.message}</ThemedText>
            {!!alert.headline && alert.headline !== alert.event && (
              <ThemedText style={styles.muted} numberOfLines={open ? undefined : 2}>
                {alert.headline}
              </ThemedText>
            )}
          </View>
          {hasDetails && (
            <AlertChevron
              openProgress={openProgress}
              color={c.mutedInk}
              style={styles.chevronWrap}
            />
          )}
        </HapticPressable>
        {hasDetails && (
          <AnimatedExpand
            openProgress={openProgress}
            style={[styles.alertContent, extreme && styles.alertExtremeBody]}
          >
            {!!alert.instruction && (
              <ThemedText style={styles.muted}>{alert.instruction}</ThemedText>
            )}
            {!!alert.expires && (
              <ThemedText style={styles.muted}>Expires: {formatTime(alert.expires)}</ThemedText>
            )}
          </AnimatedExpand>
        )}
      </View>
    </BrutalCard>
  );
}

export function WeatherAlerts({ alerts }: Readonly<{ alerts: WeatherAlert[] }>) {
  const { styles } = useStyles();
  if (alerts.length === 0) return null;
  return (
    <View style={styles.alertStack} accessibilityLabel="Weather alerts">
      {alerts.map((alert, index) => (
        <AlertCard key={`${alert.type}-${alert.event ?? alert.message}-${index}`} alert={alert} />
      ))}
    </View>
  );
}
