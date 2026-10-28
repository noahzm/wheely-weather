// Ride length for the web and Android settings. iOS uses a native menu picker
// (settings-form.ios.tsx); seven lengths don't fit a segmented control, so here
// the row opens the choices as a checklist inside the same card.
import { useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { RIDE_LENGTH_MESSAGES } from '@/domain';
import { useWheelyColors } from '@/hooks/use-theme';
import {
  RIDE_DURATION_LABELS,
  RIDE_DURATION_VALUES,
  rideDurationLabel,
  type RideDuration,
} from '@/types/settings';
import { withAlpha } from '@/utils/colors';
import { GroupedSection, useGroupedListStyles } from './grouped-list';
import { Check, ChevronDown } from './icons';
import { HapticPressable, PlatformIcon } from './primitives';

export function RideLengthSection({
  value,
  onChange,
}: Readonly<{
  value: RideDuration;
  onChange: (value: RideDuration) => void;
}>) {
  const c = useWheelyColors();
  const styles = useGroupedListStyles();
  const [open, setOpen] = useState(false);
  const label = rideDurationLabel(value);

  return (
    <GroupedSection title="Ride length" footer={RIDE_LENGTH_MESSAGES.FOOTER}>
      <HapticPressable
        onPress={() => {
          setOpen((current) => !current);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${RIDE_LENGTH_MESSAGES.ROW}: ${label}`}
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      >
        <ThemedText style={styles.rowLabel} numberOfLines={1}>
          {RIDE_LENGTH_MESSAGES.ROW}
        </ThemedText>
        <ThemedText style={styles.rowValue} numberOfLines={1}>
          {label}
        </ThemedText>
        <PlatformIcon
          icon={ChevronDown}
          size={15}
          color={withAlpha(c.ink, 0.4)}
          strokeWidth={2.5}
          style={open ? { transform: [{ rotate: '180deg' }] } : undefined}
        />
      </HapticPressable>
      {open &&
        RIDE_DURATION_VALUES.map((option, index) => {
          const selected = option === value;
          return (
            <HapticPressable
              key={option}
              onPress={() => {
                onChange(option);
                setOpen(false);
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <ThemedText style={styles.rowLabel} numberOfLines={1}>
                {RIDE_DURATION_LABELS[index]}
              </ThemedText>
              {selected && <PlatformIcon icon={Check} size={16} color={c.ink} strokeWidth={3} />}
            </HapticPressable>
          );
        })}
    </GroupedSection>
  );
}
