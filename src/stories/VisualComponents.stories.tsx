import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

import { AnimatedIcon, AnimatedSplashOverlay } from '@/components/animated-icon';

import { StorySurface } from './story-layout';

const meta = {
  title: 'Components/Visual',
  decorators: [
    (Story) => (
      <StorySurface centered maxWidth={420}>
        <Story />
      </StorySurface>
    ),
  ],
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Icon: Story = {
  render: () => <AnimatedIcon />,
};

export const SplashOverlay: Story = {
  render: () => <AnimatedSplashOverlay />,
};
