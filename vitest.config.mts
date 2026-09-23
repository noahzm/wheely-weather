import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(dirname, 'src'),
    },
  },
  test: {
    coverage: {
      // Measure every logic file, not just the ones some test happens to import:
      // without `include`, a module with no test file is invisible to the
      // thresholds. Platform files need native modules the node env can't load.
      include: ['src/domain/**', 'src/utils/**', 'src/services/**'],
      exclude: ['**/*.{test,spec}.*', '**/*.ios.*', '**/*.web.*'],
      thresholds: {
        // A floor, not a target: set below current so it catches a real
        // regression rather than firing on rounding. Raise it when the margin
        // grows, never lower it to make a run go green.
        statements: 87,
        branches: 83,
        functions: 89,
        lines: 89,
        // The scoring logic every verdict rests on is held higher than the
        // repo average, so good UI coverage can never mask a gap in here.
        'src/domain/**': { statements: 95, branches: 90, functions: 100, lines: 95 },
      },
    },
    projects: [
      {
        // `extends: true` pulls in the root `resolve.alias`, without which `@/`
        // resolves only for type-only imports (they are erased) and crashes the
        // whole suite the moment one becomes a value import.
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.{test,spec}.{js,ts,tsx}', 'workers/**/*.{test,spec}.{js,ts,tsx,mjs}'],
        },
      },
    ],
  },
});
