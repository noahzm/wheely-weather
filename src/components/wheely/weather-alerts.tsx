import { useMemo, useId, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Defs, Pattern, Polygon, Rect } from 'react-native-svg';
import { AlertTriangle, ChevronDown, Thermometer, type LucideIcon } from 'lucide-react-native';
import { SymbolView, type SFSymbol } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { useWheelyColors } from '@/hooks/use-theme';
import { Spacing, type WheelyPalette } from '@/constants/theme';
import type { WeatherAlert } from '@/types/weather';
import { BrutalCard, ButtonRadius, formatTime } from './primitives';

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
    alertTitle: { color: c.ink, fontWeight: '400', fontSize: 16, lineHeight: 20 },
    muted: {
      color: c.mutedInk,
      fontSize: 13,
      lineHeight: 18,
    },
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
      <View
        style={{
          borderTopLeftRadius: ButtonRadius - 2,
          borderTopRightRadius: ButtonRadius - 2,
          overflow: 'hidden',
        }}
      >
        <Svg width="100%" height={10}>
          <Defs>
            <Pattern id={patternId} patternUnits="userSpaceOnUse" width={20} height={20}>
              <Rect width={20} height={20} fill={stripe} />
              <Polygon points="0,0 10,0 20,10 20,20" fill={c.ink} />
              <Polygon points="0,10 0,20 10,20" fill={c.ink} />
            </Pattern>
          </Defs>
          <Rect width="100%" height={10} fill={`url(#${patternId})`} />
        </Svg>
      </View>
      <View style={{ height: 2, backgroundColor: c.ink }} />
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

function AlertChevron({ open, color }: Readonly<{ open: boolean; color: string }>) {
  const transform = [{ rotate: open ? '180deg' : '0deg' }];
  return Platform.OS === 'ios' ? (
    <SymbolView name="chevron.down" size={14} tintColor={color} style={{ transform }} />
  ) : (
    <ChevronDown size={18} color={color} style={{ transform }} />
  );
}

function AlertCard({
  alert,
  defaultOpen,
}: Readonly<{ alert: WeatherAlert; defaultOpen: boolean }>) {
  const { c, styles } = useStyles();
  const [open, setOpen] = useState(defaultOpen);
  const extreme = alert.severity === 'extreme';
  const isNws = alert.type === 'nws';
  const Icon = alert.icon === 'thermometer' ? Thermometer : AlertTriangle;
  const sfIcon =
    alert.icon === 'thermometer' ? 'thermometer.medium' : 'exclamationmark.triangle.fill';
  const hasDetails = isNws && (!!alert.instruction || !!alert.expires);

  return (
    <BrutalCard small style={styles.alertCard}>
      <HazardStripe extreme={extreme} />
      <Pressable
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
        {hasDetails && <AlertChevron open={open} color={c.mutedInk} />}
      </Pressable>
      {hasDetails && open && (
        <View style={styles.alertContent}>
          {!!alert.instruction && <ThemedText style={styles.muted}>{alert.instruction}</ThemedText>}
          {!!alert.expires && (
            <ThemedText style={styles.muted}>Expires: {formatTime(alert.expires)}</ThemedText>
          )}
        </View>
      )}
    </BrutalCard>
  );
}

export function WeatherAlerts({ alerts }: Readonly<{ alerts: WeatherAlert[] }>) {
  const { styles } = useStyles();
  if (alerts.length === 0) return null;
  return (
    <View style={styles.alertStack} accessibilityLabel="Weather alerts">
      {alerts.map((alert, index) => (
        <AlertCard
          key={`${alert.type}-${alert.event ?? alert.message}-${index}`}
          alert={alert}
          defaultOpen={index === 0 && alert.severity === 'extreme'}
        />
      ))}
    </View>
  );
}
