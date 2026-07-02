import type { Preview } from '@storybook/react-native-web-vite';

import './preview.css';

import { ColorSchemeOverrideContext } from '../src/hooks/use-theme';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },

    // The "Theme" toolbar below drives both the component theme and the
    // canvas background, so the default backgrounds toggle is redundant.
    backgrounds: { disable: true },

    a11y: {
      // Storybook a11y test mode — report-only in the test UI (not a task marker).
      // Alternatives: 'error' (fail CI on violations) or 'off' (skip checks).

      test: 'todo',
    },
  },

  initialGlobals: {
    theme: 'light',
  },

  globalTypes: {
    theme: {
      description: 'Color scheme applied to the previewed components',
      toolbar: {
        title: 'Theme',
        icon: 'contrast',
        items: [
          { value: 'light', title: 'Light', icon: 'sun' },
          { value: 'dark', title: 'Dark', icon: 'moon' },
        ],
        dynamicTitle: true,
      },
    },
  },

  decorators: [
    (Story, context) => {
      const scheme = context.globals.theme === 'dark' ? 'dark' : 'light';
      return (
        <ColorSchemeOverrideContext.Provider value={scheme}>
          <Story />
        </ColorSchemeOverrideContext.Provider>
      );
    },
  ],
};

export default preview;
