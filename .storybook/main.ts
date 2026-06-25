import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { StorybookConfig } from '@storybook/react-native-web-vite';

const dirname = path.dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  stories: [
    '../src/**/*.mdx',
    '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)',
  ],
  addons: [
    '@storybook/addon-vitest',
    '@storybook/addon-a11y',
    '@storybook/addon-docs',
  ],
  framework: '@storybook/react-native-web-vite',
  viteFinal: async (config) => {
    config.resolve ??= {};
    config.resolve.alias = {
      ...(Array.isArray(config.resolve.alias) ? {} : config.resolve.alias),
      'expo-image': path.resolve(dirname, 'mocks/expo-image.tsx'),
      'expo-modules-core': path.resolve(dirname, 'mocks/expo-modules-core.ts'),
      'expo-symbols': path.resolve(dirname, 'mocks/expo-symbols.tsx'),
    };
    return config;
  },
};
export default config;
