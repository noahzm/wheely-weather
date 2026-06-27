import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { StorybookConfig } from '@storybook/react-native-web-vite';

const dirname = path.dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: ['@storybook/addon-vitest', '@storybook/addon-a11y', '@storybook/addon-docs'],
  framework: '@storybook/react-native-web-vite',
  viteFinal: (config) => {
    // vite-tsconfig-paths is injected by this framework but is redundant in
    // Vite 8, which resolves tsconfig paths natively. Filter it out to silence
    // the deprecation warning, then enable the native option.
    config.plugins = (config.plugins ?? []).filter(
      (p) => !(p && typeof p === 'object' && 'name' in p && p.name === 'vite-tsconfig-paths'),
    );
    config.resolve ??= {};
    config.resolve.tsconfigPaths = true;
    // alias can also be an array form; narrow to the object form before spreading.
    // (Array.isArray doesn't narrow Vite's readonly array type, hence the assertion.)
    const existingAlias: Record<string, string> =
      config.resolve.alias && !Array.isArray(config.resolve.alias)
        ? (config.resolve.alias as Record<string, string>)
        : {};
    config.resolve.alias = {
      ...existingAlias,
      'expo-image': path.resolve(dirname, 'mocks/expo-image.tsx'),
      'expo-modules-core': path.resolve(dirname, 'mocks/expo-modules-core.ts'),
      'expo-symbols': path.resolve(dirname, 'mocks/expo-symbols.tsx'),
    };
    return config;
  },
};
export default config;
