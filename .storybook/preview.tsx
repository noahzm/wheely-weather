import type { Preview } from '@storybook/react-native-web-vite'

import './preview.css'

import { Colors } from '../src/constants/theme'
import { ColorSchemeOverrideContext } from '../src/hooks/use-theme'

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
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: 'todo'
    }
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
      const scheme = context.globals.theme === 'dark' ? 'dark' : 'light'
      return (
        <ColorSchemeOverrideContext.Provider value={scheme}>
          <div style={{ minHeight: '100vh', backgroundColor: Colors[scheme].background }}>
            <Story />
          </div>
        </ColorSchemeOverrideContext.Provider>
      )
    },
  ],
};

export default preview;
