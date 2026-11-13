import { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing, Type, Radius, type WheelyPalette } from '@/constants/theme';
import { useRideDuration } from '@/hooks/settings-context';
import { useWheelyColors } from '@/hooks/use-theme';
import { RIDE_DURATION_LABELS, RIDE_DURATION_VALUES, type RideDuration } from '@/types/settings';
import { withAlpha } from '@/utils/colors';
import { ChevronRight } from './icons';
import {
  CardBorderWidth,
  HapticPressable,
  makeButtonStyles,
  PlatformIcon,
  SectionHeading,
} from './primitives';
import { useRideLengthPreview } from './use-ride-length-preview';

function makeStyles(c: WheelyPalette) {
  return StyleSheet.create({
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.half,
      marginLeft: 'auto',
      minHeight: 32,
      paddingLeft: Spacing.two + Spacing.half,
      paddingRight: Spacing.one + Spacing.half,
      paddingVertical: Spacing.half,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: Radius.pill,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null),
    },
    chipStacked: { marginLeft: 0, maxWidth: '100%' },
    chipPressed: {
      backgroundColor: withAlpha(c.ink, 0.08),
    },
    chipText: {
      flexShrink: 1,
      color: c.ink,
      fontFamily: Fonts.body,
      fontWeight: '400',
      ...Type.micro,
    },
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
  const preview = useRideLengthPreview(draft);

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
                accessibilityState={{ checked: draft === value, selected: draft === value }}
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
            {preview.timing ? (
              <>
                <ThemedText style={styles.text}>{preview.timing}</ThemedText>
                <ThemedText style={styles.muted}>{preview.conditionText}</ThemedText>
              </>
            ) : (
              <ThemedText style={styles.muted}>{preview.fallbackText}</ThemedText>
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

/** Ride-length pill trigger paired with its bottom sheet picker. */
export function RideLengthControl({ chip, stacked }: Readonly<{ chip: string; stacked: boolean }>) {
  const c = useWheelyColors();
  const styles = makeStyles(c);
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <>
      <HapticPressable
        onPress={() => {
          setPickerOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${chip}. Change ride length`}
        hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
        style={({ pressed }) => [
          styles.chip,
          stacked && styles.chipStacked,
          pressed && styles.chipPressed,
        ]}
      >
        <ThemedText style={styles.chipText}>{chip}</ThemedText>
        <PlatformIcon
          icon={ChevronRight}
          sf="chevron.right"
          size={11}
          color={c.ink}
          strokeWidth={2.5}
        />
      </HapticPressable>
      <RideLengthPicker
        visible={pickerOpen}
        onClose={() => {
          setPickerOpen(false);
        }}
      />
    </>
  );
}
