import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing, Type, Radius, type WheelyPalette } from '@/constants/theme';
import { CONDITION_DISPLAY, getRideVerdict } from '@/domain';
import { useForecast } from '@/hooks/forecast-context';
import { useResolvedTempUnit, useRideDuration } from '@/hooks/settings-context';
import { useWheelyColors } from '@/hooks/use-theme';
import { previewRideLength } from '@/services/rideLengthPreview';
import { RIDE_DURATION_LABELS, RIDE_DURATION_VALUES, type RideDuration } from '@/types/settings';
import { withAlpha } from '@/utils/colors';
import { formatHourSpan } from '@/utils/timeFormat';
import { CardBorderWidth, HapticPressable, makeButtonStyles, SectionHeading } from './primitives';

function makeStyles(c: WheelyPalette) {
  return StyleSheet.create({
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: withAlpha(c.shadow, 0.5) },
    sheet: {
      width: '100%',
      maxWidth: 600,
      alignSelf: 'center',
      maxHeight: '90%',
      backgroundColor: c.paper,
      borderWidth: CardBorderWidth,
      borderBottomWidth: 0,
      borderColor: c.border,
      borderTopLeftRadius: Radius.card,
      borderTopRightRadius: Radius.card,
      padding: Spacing.four,
      gap: Spacing.three,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.two,
    },
    choices: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
    option: { minWidth: '28%', flexGrow: 1, minHeight: 48 },
    text: { color: c.ink, ...Type.body },
    muted: { color: c.mutedInk, ...Type.small },
    preview: {
      backgroundColor: c.background,
      borderWidth: 1,
      borderColor: c.divider,
      borderRadius: Radius.card,
      padding: Spacing.three,
      gap: Spacing.two,
    },
    scroll: { gap: Spacing.three },
  });
}

function RideLengthSheet({ onClose }: Readonly<{ onClose: () => void }>) {
  const c = useWheelyColors();
  const styles = makeStyles(c);
  const buttons = makeButtonStyles(c);
  const insets = useSafeAreaInsets();
  const [duration, setDuration] = useRideDuration();
  const [draft, setDraft] = useState<RideDuration>(duration);
  const { snapshot } = useForecast();
  const unit = useResolvedTempUnit();
  const weather = snapshot ? previewRideLength(snapshot, draft) : null;
  const verdict =
    weather && snapshot ? getRideVerdict(weather, snapshot.acclimatization.thresholds, unit) : null;
  const window = verdict?.window;
  const day = verdict?.when === 'tomorrow' ? 'Tomorrow' : 'Today';
  const warning = verdict?.status === 'no' ? ' · Riding not recommended' : '';
  const timing = window ? `${day} · ${formatHourSpan(window.startHour, window.endHour)}` : null;

  return (
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessible={false} />
      <View
        style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.four) }]}
        accessibilityViewIsModal
      >
        <View style={styles.header}>
          <SectionHeading>Ride length</SectionHeading>
          <HapticPressable onPress={onClose} accessibilityRole="button" style={buttons.base}>
            <ThemedText style={buttons.label}>Cancel</ThemedText>
          </HapticPressable>
        </View>
        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedText style={styles.muted}>Find the best window for your ride.</ThemedText>
          <View style={styles.choices}>
            {RIDE_DURATION_VALUES.map((value, index) => (
              <HapticPressable
                key={value}
                onPress={() => {
                  setDraft(value);
                }}
                accessibilityRole="radio"
                accessibilityState={{ checked: draft === value }}
                style={({ pressed }) => [
                  buttons.base,
                  styles.option,
                  draft === value ? buttons.primary : buttons.surface,
                  pressed && buttons.pressed,
                ]}
              >
                <ThemedText style={[buttons.label, draft === value && buttons.primaryLabel]}>
                  {RIDE_DURATION_LABELS[index]}
                </ThemedText>
              </HapticPressable>
            ))}
          </View>
          <View style={styles.preview} accessibilityLiveRegion="polite">
            {timing ? (
              <>
                <ThemedText style={styles.text}>{timing}</ThemedText>
                <ThemedText style={styles.muted}>
                  {verdict ? `${CONDITION_DISPLAY[verdict.condition]} conditions${warning}` : ''}
                </ThemedText>
              </>
            ) : (
              <ThemedText style={styles.muted}>
                {weather
                  ? 'No ride window available in this forecast.'
                  : 'Apply this length to refresh your ride window.'}
              </ThemedText>
            )}
          </View>
          <HapticPressable
            accessibilityRole="button"
            onPress={() => {
              setDuration(draft);
              onClose();
            }}
            style={({ pressed }) => [buttons.base, buttons.primary, pressed && buttons.pressed]}
          >
            <ThemedText style={[buttons.label, buttons.primaryLabel]}>
              Use this ride length
            </ThemedText>
          </HapticPressable>
        </ScrollView>
      </View>
    </View>
  );
}

export function RideLengthPicker({
  visible,
  onClose,
}: Readonly<{ visible: boolean; onClose: () => void }>) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {visible && <RideLengthSheet onClose={onClose} />}
    </Modal>
  );
}
