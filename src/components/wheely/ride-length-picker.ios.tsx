import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  BottomSheet,
  Button,
  Group,
  Host,
  HStack,
  Image,
  Picker,
  Spacer,
  Text,
  VStack,
} from '@expo/ui/swift-ui';
import {
  accessibilityAddTraits,
  accessibilityElement,
  accessibilityHidden,
  accessibilityLabel,
  background,
  buttonBorderShape,
  buttonStyle,
  clipShape,
  controlSize,
  font,
  foregroundStyle,
  frame,
  labelsHidden,
  padding,
  pickerStyle,
  preferredColorScheme,
  presentationDragIndicator,
  tag,
  tint,
} from '@expo/ui/swift-ui/modifiers';

import { Radius } from '@/constants/theme';
import { useRideDuration } from '@/hooks/settings-context';
import { useColorSchemeName, useWheelyColors } from '@/hooks/use-theme';
import { RIDE_DURATION_LABELS, RIDE_DURATION_VALUES, type RideDuration } from '@/types/settings';
import { selectionFeedback } from '@/utils/haptics';
import { useRideLengthPreview } from './use-ride-length-preview';

const styles = StyleSheet.create({
  trigger: {
    marginLeft: 'auto',
  },
  triggerStacked: {
    marginLeft: 0,
    maxWidth: '100%',
  },
});

function RideLengthSheetContent({ onClose }: Readonly<{ onClose: () => void }>) {
  const c = useWheelyColors();
  const scheme = useColorSchemeName();
  const [duration, setDuration] = useRideDuration();
  const [draft, setDraft] = useState<RideDuration>(duration);
  const preview = useRideLengthPreview(draft);

  return (
    <Group modifiers={[presentationDragIndicator('visible'), preferredColorScheme(scheme)]}>
      <VStack alignment="leading" spacing={16} modifiers={[padding({ all: 20 })]}>
        <HStack alignment="center">
          <Text
            modifiers={[
              font({ textStyle: 'title3', weight: 'bold' }),
              foregroundStyle(c.ink),
              accessibilityAddTraits(['isHeader']),
            ]}
          >
            Ride length
          </Text>
          <Spacer />
          <Button
            role="cancel"
            label="Cancel"
            onPress={() => {
              selectionFeedback();
              onClose();
            }}
          />
        </HStack>

        <Text
          modifiers={[
            font({ textStyle: 'subheadline' }),
            foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
          ]}
        >
          Find the best window for your ride.
        </Text>

        <Picker<RideDuration>
          label="Ride length"
          selection={draft}
          onSelectionChange={(value) => {
            selectionFeedback();
            setDraft(value);
          }}
          modifiers={[pickerStyle('wheel'), labelsHidden(), accessibilityLabel('Ride length')]}
        >
          {RIDE_DURATION_VALUES.map((value, index) => (
            <Text key={value} modifiers={[tag(value)]}>
              {RIDE_DURATION_LABELS[index]}
            </Text>
          ))}
        </Picker>

        <VStack
          alignment="leading"
          spacing={4}
          modifiers={[
            padding({ all: 12 }),
            frame({ maxWidth: Infinity, alignment: 'leading' }),
            background(c.background),
            clipShape('roundedRectangle', Radius.card),
            accessibilityElement('combine'),
          ]}
        >
          {preview.timing ? (
            <>
              <Text
                modifiers={[font({ textStyle: 'body', weight: 'medium' }), foregroundStyle(c.ink)]}
              >
                {preview.timing}
              </Text>
              <Text
                modifiers={[
                  font({ textStyle: 'subheadline' }),
                  foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
                ]}
              >
                {preview.conditionText}
              </Text>
            </>
          ) : (
            <Text
              modifiers={[
                font({ textStyle: 'subheadline' }),
                foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
              ]}
            >
              {preview.fallbackText}
            </Text>
          )}
        </VStack>

        <Button
          onPress={() => {
            selectionFeedback();
            setDuration(draft);
            onClose();
          }}
          modifiers={[
            buttonStyle('borderedProminent'),
            controlSize('large'),
            tint(c.primary),
            foregroundStyle(c.primaryInk),
            accessibilityLabel('Use this ride length'),
          ]}
        >
          <Text
            modifiers={[
              font({ textStyle: 'body', weight: 'semibold' }),
              foregroundStyle(c.primaryInk),
              frame({ maxWidth: Infinity }),
            ]}
          >
            Use this ride length
          </Text>
        </Button>
      </VStack>
    </Group>
  );
}

export function RideLengthPicker({
  visible,
  onClose,
}: Readonly<{ visible: boolean; onClose: () => void }>) {
  const scheme = useColorSchemeName();

  return (
    <Host colorScheme={scheme}>
      <BottomSheet
        isPresented={visible}
        onIsPresentedChange={(next) => {
          if (!next) onClose();
        }}
        fitToContents
      >
        <RideLengthSheetContent onClose={onClose} />
      </BottomSheet>
    </Host>
  );
}

/** Native iOS ride-length capsule trigger anchored to a SwiftUI BottomSheet. */
export function RideLengthControl({ chip, stacked }: Readonly<{ chip: string; stacked: boolean }>) {
  const c = useWheelyColors();
  const scheme = useColorSchemeName();
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <View style={stacked ? styles.triggerStacked : styles.trigger}>
      <Host matchContents colorScheme={scheme}>
        <BottomSheet
          isPresented={pickerOpen}
          onIsPresentedChange={setPickerOpen}
          fitToContents
          anchor={
            <Button
              onPress={() => {
                selectionFeedback();
                setPickerOpen(true);
              }}
              modifiers={[
                buttonStyle('bordered'),
                buttonBorderShape('capsule'),
                controlSize('small'),
                tint(c.ink),
                accessibilityLabel(`${chip}. Change ride length`),
              ]}
            >
              <HStack spacing={4}>
                <Text
                  modifiers={[
                    font({ textStyle: 'footnote', weight: 'medium' }),
                    foregroundStyle(c.ink),
                  ]}
                >
                  {chip}
                </Text>
                <Image
                  systemName="chevron.right"
                  size={11}
                  modifiers={[foregroundStyle(c.mutedInk), accessibilityHidden(true)]}
                />
              </HStack>
            </Button>
          }
        >
          <RideLengthSheetContent
            onClose={() => {
              setPickerOpen(false);
            }}
          />
        </BottomSheet>
      </Host>
    </View>
  );
}
