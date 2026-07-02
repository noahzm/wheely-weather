import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { fn } from 'storybook/test';
import { View } from 'react-native';

import {
  DailyForecast,
  ErrorState,
  HourlyForecast,
  KitGuide,
  LoadingState,
  RideSpecs,
  RideVerdict,
  WeatherAlerts,
  WeatherHeader,
} from '@/components/wheely';
import { BrutalCard, Chip, SectionTitle } from '@/components/wheely/primitives';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

import { alertWeather, maybeWeather, restWeather, rideWeather } from './weather-fixtures';
import { StorySurface } from './story-layout';

const meta = {
  title: 'Wheely UI/Overview',
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

const weatherScenarios = {
  'Ride day': rideWeather,
  'Mixed conditions': maybeWeather,
  'Rest day': restWeather,
  'Alert day': alertWeather,
};

export const Foundations: Story = {
  render: () => (
    <>
      <SectionTitle title="Foundation pieces" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
        <Chip>Default</Chip>
        <Chip primary>Primary</Chip>
        <Chip ink>Ink</Chip>
        <Chip condition="good">Good</Chip>
        <Chip condition="fair">Fair</Chip>
        <Chip condition="marginal">Iffy</Chip>
        <Chip condition="poor">Poor</Chip>
        <Chip condition="bad">Bad</Chip>
      </View>
      <BrutalCard>
        <ThemedText type="smallBold">BrutalCard</ThemedText>
        <ThemedText type="small">
          A hard-edged panel used throughout the forecast interface.
        </ThemedText>
      </BrutalCard>
      <BrutalCard small>
        <ThemedText type="smallBold">Small card variant</ThemedText>
      </BrutalCard>
    </>
  ),
};

export const ChipControl: StoryObj<typeof Chip> = {
  args: {
    children: 'Ride day',
    condition: undefined,
    primary: false,
    ink: false,
  },
  argTypes: {
    children: { control: 'text', description: 'Chip label' },
    condition: {
      control: 'select',
      options: [undefined, 'good', 'fair', 'marginal', 'poor', 'bad'],
      description: 'Condition color overrides primary/ink',
    },
    primary: { control: 'boolean' },
    ink: { control: 'boolean' },
  },
  render: (args) => <Chip {...args} />,
};

export const Card: StoryObj<{ small: boolean; title: string; body: string }> = {
  args: {
    small: false,
    title: 'BrutalCard',
    body: 'A hard-edged panel used throughout the forecast interface.',
  },
  argTypes: {
    small: { control: 'boolean', description: 'Use the compact card variant' },
    title: { control: 'text' },
    body: { control: 'text' },
  },
  render: ({ small, title, body }) => (
    <BrutalCard small={small}>
      <ThemedText type="smallBold">{title}</ThemedText>
      {!!body && <ThemedText type="small">{body}</ThemedText>}
    </BrutalCard>
  ),
};

export const Header: StoryObj<typeof WeatherHeader> = {
  args: {
    location: 'Portland, OR',
    statusMessage: 'Using saved location.',
    onOpenLocation: fn(),
  },
  argTypes: {
    location: { control: 'text' },
    statusMessage: { control: 'text' },
    onOpenLocation: { action: 'onOpenLocation' },
  },
  render: (args) => <WeatherHeader {...args} />,
};

export const Verdict: StoryObj<typeof RideVerdict> = {
  args: {
    status: 'yes',
    message: 'Smooth miles are on deck.',
  },
  argTypes: {
    status: {
      control: 'inline-radio',
      options: ['yes', 'maybe', 'no'],
    },
    message: { control: 'text' },
  },
  render: (args) => <RideVerdict {...args} />,
};

export const Alerts: StoryObj<{ scenario: keyof typeof weatherScenarios }> = {
  args: {
    scenario: 'Alert day',
  },
  argTypes: {
    scenario: {
      control: 'select',
      options: Object.keys(weatherScenarios),
      description: 'Weather scenario to pull alerts from',
    },
  },
  render: ({ scenario }) => <WeatherAlerts alerts={weatherScenarios[scenario].nwsAlerts ?? []} />,
};

export const Hourly: StoryObj<{ scenario: keyof typeof weatherScenarios; available: boolean }> = {
  args: {
    scenario: 'Ride day',
    available: true,
  },
  argTypes: {
    scenario: {
      control: 'select',
      options: Object.keys(weatherScenarios),
    },
    available: {
      control: 'boolean',
      description: 'Toggle off to preview the unavailable state',
    },
  },
  render: ({ scenario, available }) => {
    const weather = weatherScenarios[scenario];
    return (
      <HourlyForecast
        hourly={available ? weather.hourly : []}
        pastHourly={available ? weather.pastHourly : []}
      />
    );
  },
};

export const KitGuideStory: StoryObj<{ scenario: keyof typeof weatherScenarios }> = {
  name: 'Kit Guide',
  args: {
    scenario: 'Ride day',
  },
  argTypes: {
    scenario: {
      control: 'select',
      options: Object.keys(weatherScenarios),
    },
  },
  render: ({ scenario }) => <KitGuide weather={weatherScenarios[scenario]} />,
};

export const RideSpecsStory: StoryObj<{ scenario: keyof typeof weatherScenarios }> = {
  name: 'Ride Specs',
  args: {
    scenario: 'Mixed conditions',
  },
  argTypes: {
    scenario: {
      control: 'select',
      options: Object.keys(weatherScenarios),
    },
  },
  render: ({ scenario }) => <RideSpecs weather={weatherScenarios[scenario]} />,
};

export const Daily: StoryObj<{ scenario: keyof typeof weatherScenarios; available: boolean }> = {
  args: {
    scenario: 'Rest day',
    available: true,
  },
  argTypes: {
    scenario: {
      control: 'select',
      options: Object.keys(weatherScenarios),
    },
    available: {
      control: 'boolean',
      description: 'Toggle off to preview the unavailable state',
    },
  },
  render: ({ scenario, available }) => (
    <DailyForecast daily={available ? weatherScenarios[scenario].daily : []} />
  ),
};

export const ErrorScreen: StoryObj<typeof ErrorState> = {
  name: 'Error',
  decorators: [
    (Story) => (
      <StorySurface centered>
        <Story />
      </StorySurface>
    ),
  ],
  args: {
    kind: 'network',
    onRetry: fn(),
  },
  argTypes: {
    kind: {
      control: 'inline-radio',
      options: ['network', 'default'],
    },
    onRetry: { action: 'onRetry' },
  },
  render: (args) => <ErrorState {...args} />,
};

export const Loading: Story = {
  decorators: [
    (Story) => (
      <StorySurface centered>
        <Story />
      </StorySurface>
    ),
  ],
  render: () => <LoadingState />,
};
