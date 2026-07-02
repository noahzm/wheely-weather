const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const pluginReactNative = require('eslint-plugin-react-native');
const tseslint = require('typescript-eslint');
const unicorn = require('eslint-plugin-unicorn').default ?? require('eslint-plugin-unicorn');
const sonarjs = require('eslint-plugin-sonarjs');
const prettierConfig = require('eslint-config-prettier');
const path = require('node:path');

// Type-aware linting reads a tsconfig that includes test files too (the build
// tsconfig.json excludes them) so tests get the same strict coverage as source.
const ESLINT_TSCONFIG = 'tsconfig.eslint.json';

module.exports = defineConfig([
  // ── Ignores (generated/build output) ────────────────────────────────────
  {
    ignores: [
      'dist/**',
      'storybook-static/**',
      '.expo/**',
      'node_modules/**',
      'coverage/**',
      'web-build/**',
      'playwright-report/**',
      'test-results/**',
      '.rnstorybook/**',
    ],
  },

  // ── Expo base ────────────────────────────────────────────────────────────
  expoConfig,

  // ── TypeScript files: type-aware strict rules ────────────────────────────
  // The tree is clean, so all rules are `error` and CI runs with
  // `--max-warnings 0` — any violation (warning or error) fails the build.
  ...tseslint.configs.strictTypeChecked.map((c) => ({
    ...c,
    files: ['**/*.{ts,tsx}'],
  })),
  ...tseslint.configs.stylisticTypeChecked.map((c) => ({
    ...c,
    files: ['**/*.{ts,tsx}'],
  })),
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: ESLINT_TSCONFIG,
        tsconfigRootDir: path.resolve(__dirname),
      },
    },
    rules: {
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/no-unnecessary-condition': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/no-deprecated': 'error',

      // ── Naming conventions (SwiftLint identifier_name / type_name) ─────
      // Enforce casing only; boolean-prefix conventions are intentionally not
      // required (too noisy for idiomatic names like `busy`, `open`, `visible`).
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'variable', format: ['camelCase', 'PascalCase', 'UPPER_CASE'] },
        { selector: 'function', format: ['camelCase', 'PascalCase'] },
        { selector: 'typeLike', format: ['PascalCase'] },
      ],
    },
  },

  // ── JS files: non-type-checked strict rules ──────────────────────────────
  // Plain-JS domain/util files: the type-aware rules need richer config tuning
  // to avoid false positives on untyped JS, so apply the non-type-checked
  // strict preset here. (Logic is still unit-tested in src/**/*.test.js.)
  ...tseslint.configs.strict.map((c) => ({
    ...c,
    files: ['**/*.{js,jsx}'],
  })),

  // ── Unicorn (modern JS idioms — SwiftLint style rules) ───────────────────
  unicorn.configs['flat/recommended'],
  {
    rules: {
      // Disabled only where the rule genuinely conflicts with RN/Expo idioms:
      'unicorn/filename-case': 'off', // mixed kebab/PascalCase is intentional here
      'unicorn/prevent-abbreviations': 'off', // 'props', 'ref', 'params' are idiomatic
      'unicorn/no-null': 'off', // React & RN APIs use null
      'unicorn/prefer-module': 'off', // these config files are CommonJS
      'unicorn/prefer-top-level-await': 'off', // not applicable in RN/Expo entry points
      'unicorn/no-array-reduce': 'error',
      'unicorn/no-array-callback-reference': 'error',
      'unicorn/consistent-function-scoping': 'error',
    },
  },

  // ── SonarJS (complexity & bug patterns — SwiftLint cyclomatic_complexity) ─
  sonarjs.configs.recommended,
  {
    rules: {
      'sonarjs/cognitive-complexity': ['error', 20],
      'sonarjs/prefer-read-only-props': 'error',
      'sonarjs/no-nested-conditional': 'error',
    },
  },

  // ── React Native rules ───────────────────────────────────────────────────
  {
    plugins: { 'react-native': pluginReactNative },
    rules: {
      'react-native/no-unused-styles': 'off',
      'react-native/no-color-literals': 'error',
    },
  },

  // ── Complexity / length caps (SwiftLint function_body_length, nesting) ───
  {
    rules: {
      complexity: ['error', 20],
      'max-depth': ['error', 4],
      'max-params': ['error', 5],
      'max-lines': ['error', { max: 700, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 120, skipBlankLines: true, skipComments: true }],
    },
  },

  // ── CommonJS config / scripts / entry ───────────────────────────────────
  // These files are genuinely CommonJS (Metro/ESLint config loaders are CJS,
  // and the Expo entry uses a conditional require to swap Storybook in/out),
  // so `require()` is correct here rather than ESM imports.
  {
    files: ['eslint.config.js', 'metro.config.js', '*.config.js', 'scripts/**/*.js', 'index.ts'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  // ── Storybook mock modules ──────────────────────────────────────────────
  // These hand-written stubs replicate native module shapes for the web
  // Storybook build; empty methods/classes and a pseudo-random uuid are
  // intentional for a test double, not omissions.
  {
    files: ['.storybook/mocks/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-extraneous-class': 'off',
      '@typescript-eslint/require-await': 'off',
      'sonarjs/pseudo-random': 'off',
    },
  },

  // ── Test files: relax rules that don't make sense for tests ─────────────
  {
    files: ['**/*.{test,spec}.{js,jsx,ts,tsx}'],
    rules: {
      'max-lines': 'off', // test suites can be long by design
      'max-lines-per-function': 'off', // describe() blocks are legitimately long
      'sonarjs/no-duplicate-string': 'off',
      'sonarjs/no-nested-conditional': 'off', // terse inline expectations are fine in tests
      'unicorn/consistent-function-scoping': 'off', // test-local helper closures are idiomatic
    },
  },

  // ── Prettier (must be last — disables formatting rules) ─────────────────
  prettierConfig,
]);
