import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { Pressable, View } from 'react-native';

import { ExternalLink } from '@/components/external-link';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

import { StorySurface } from './story-layout';

const meta = {
  title: 'Components/Primitives',
  decorators: [
    (Story) => (
      <StorySurface>
        <Story />
      </StorySurface>
    ),
  ],
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const textTypes = [
  'title',
  'subtitle',
  'default',
  'small',
  'smallBold',
  'link',
  'linkPrimary',
  'code',
] as const;

export const Text: StoryObj<{ type: (typeof textTypes)[number]; content: string }> = {
  args: {
    type: 'default',
    content: 'The quick brown fox jumps over the lazy dog.',
  },
  argTypes: {
    type: {
      control: 'select',
      options: textTypes,
      description: 'ThemedText variant',
    },
    content: { control: 'text' },
  },
  render: ({ type, content }) => <ThemedText type={type}>{content}</ThemedText>,
};

export const TextVariants: Story = {
  render: () => (
    <>
      <ThemedText type="title">Title text</ThemedText>
      <ThemedText type="subtitle">Subtitle text</ThemedText>
      <ThemedText>Default body text</ThemedText>
      <ThemedText type="small">Small text</ThemedText>
      <ThemedText type="smallBold">Small bold text</ThemedText>
      <ThemedText type="link">Link text</ThemedText>
      <ThemedText type="linkPrimary">Primary link text</ThemedText>
      <ThemedText type="code">src/components/themed-text.tsx</ThemedText>
    </>
  ),
};

export const ThemedViewVariants: Story = {
  render: () => (
    <View style={{ gap: Spacing.three }}>
      {(['background', 'paper', 'border'] as const).map((type) => (
        <ThemedView
          key={type}
          type={type}
          style={{ padding: Spacing.four, borderRadius: Spacing.two }}
        >
          <ThemedText type="smallBold">{type}</ThemedText>
        </ThemedView>
      ))}
    </View>
  ),
};

export const Link: StoryObj<{ href: string; label: string }> = {
  args: {
    href: 'https://docs.expo.dev',
    label: 'Expo documentation',
  },
  argTypes: {
    href: { control: 'text' },
    label: { control: 'text' },
  },
  render: ({ href, label }) => (
    <ExternalLink href={href} asChild>
      <Pressable>
        <ThemedText type="linkPrimary">{label}</ThemedText>
      </Pressable>
    </ExternalLink>
  ),
};
