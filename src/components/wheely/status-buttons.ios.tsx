import { Button, Host, VStack } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonStyle,
  controlSize,
  disabled,
  foregroundStyle,
  frame,
  labelStyle,
  tint,
} from '@expo/ui/swift-ui/modifiers';

import { Spacing } from '@/constants/theme';
import { useColorSchemeName, useWheelyColors } from '@/hooks/use-theme';
import { selectionFeedback } from '@/utils/haptics';

/** Native SwiftUI refresh action for the empty-state error card on iOS. */
export function RefreshForecastButton({ onRetry }: Readonly<{ onRetry: () => void }>) {
  const c = useWheelyColors();
  const scheme = useColorSchemeName();

  return (
    <Host matchContents colorScheme={scheme}>
      <Button
        label="Refresh"
        systemImage="arrow.clockwise"
        onPress={() => {
          selectionFeedback();
          onRetry();
        }}
        modifiers={[
          buttonStyle('borderedProminent'),
          controlSize('large'),
          tint(c.primary),
          foregroundStyle(c.primaryInk),
          accessibilityLabel('Refresh forecast'),
        ]}
      />
    </Host>
  );
}

/** Native SwiftUI icon-only retry action for the stale-data notice on iOS. */
export function StaleRetryButton({ onRetry }: Readonly<{ onRetry: () => void }>) {
  const c = useWheelyColors();
  const scheme = useColorSchemeName();

  return (
    <Host matchContents colorScheme={scheme}>
      <Button
        label="Retry refresh"
        systemImage="arrow.clockwise"
        onPress={() => {
          selectionFeedback();
          onRetry();
        }}
        modifiers={[
          labelStyle('iconOnly'),
          buttonStyle('borderless'),
          tint(c.ink),
          frame({ minWidth: 44, minHeight: 44 }),
        ]}
      />
    </Host>
  );
}

/** Native SwiftUI location prompt buttons for iOS. */
export function LocationPromptButtons({
  busy,
  onUseDeviceLocation,
  onChooseLocation,
}: Readonly<{
  busy: boolean;
  onUseDeviceLocation: () => void;
  onChooseLocation: () => void;
}>) {
  const c = useWheelyColors();
  const scheme = useColorSchemeName();

  return (
    <Host matchContents colorScheme={scheme}>
      <VStack spacing={Spacing.two}>
        <Button
          label="Use current location"
          systemImage="location.fill"
          onPress={() => {
            selectionFeedback();
            onUseDeviceLocation();
          }}
          modifiers={[
            buttonStyle('borderedProminent'),
            controlSize('large'),
            disabled(busy),
            tint(c.primary),
            foregroundStyle(c.primaryInk),
            accessibilityLabel('Use current location'),
          ]}
        />
        <Button
          label="Search for a city"
          systemImage="magnifyingglass"
          onPress={() => {
            selectionFeedback();
            onChooseLocation();
          }}
          modifiers={[
            buttonStyle('bordered'),
            controlSize('large'),
            tint(c.ink),
            foregroundStyle(c.ink),
            accessibilityLabel('Search for a city'),
          ]}
        />
      </VStack>
    </Host>
  );
}
