import { Button, Host, HStack } from '@expo/ui/swift-ui';
import {
  accessibilityAddTraits,
  accessibilityHint,
  accessibilityLabel,
  buttonBorderShape,
  buttonStyle,
  controlSize,
  foregroundStyle,
  tint,
} from '@expo/ui/swift-ui/modifiers';

import { useColorSchemeName, useWheelyColors } from '@/hooks/use-theme';
import { selectionFeedback } from '@/utils/haptics';

/** Native SwiftUI capsule buttons for jumping to "Now" or "Best ride" on iOS. */
export function HourlyShortcutButtons({
  nowIdx,
  bestRideIdx,
  selectedIdx,
  onSelectIndex,
}: Readonly<{
  nowIdx: number;
  bestRideIdx: number | null;
  selectedIdx: number;
  onSelectIndex: (index: number) => void;
}>) {
  const c = useWheelyColors();
  const scheme = useColorSchemeName();
  const shortcuts = [
    { label: 'Now', index: nowIdx },
    ...(bestRideIdx == null ? [] : [{ label: 'Best ride', index: bestRideIdx }]),
  ];

  return (
    <Host matchContents colorScheme={scheme}>
      <HStack spacing={8}>
        {shortcuts.map(({ label, index }) => {
          const selected = selectedIdx === index;
          return (
            <Button
              key={label}
              label={label}
              onPress={() => {
                selectionFeedback();
                onSelectIndex(index);
              }}
              modifiers={[
                buttonStyle(selected ? 'borderedProminent' : 'bordered'),
                buttonBorderShape('capsule'),
                controlSize('small'),
                tint(selected ? c.accent : c.ink),
                foregroundStyle(selected ? c.accentInk : c.ink),
                accessibilityLabel(label),
                accessibilityHint('Center this hour on the riding conditions chart'),
                ...(selected ? [accessibilityAddTraits(['isSelected'])] : []),
              ]}
            />
          );
        })}
      </HStack>
    </Host>
  );
}
