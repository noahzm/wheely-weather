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
      '.expo/**',
      'node_modules/**',
      'coverage/**',
      'web-build/**',
      'playwright-report/**',
      'test-results/**',
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
      // Only overrides and additions live here; strictTypeChecked and
      // stylisticTypeChecked already enable the no-unsafe-*, no-explicit-any,
      // no-unnecessary-condition, prefer-nullish-coalescing and no-deprecated rules.
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      // A switch over a union (Condition, IssueTier, ...) must handle every
      // member, so adding one to the type flags each switch that ignores it.
      // A `default` branch doesn't count: it would silently absorb the new member.
      '@typescript-eslint/switch-exhaustiveness-check': 'error',

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
  // Config files, Expo config plugins, and the Cloudflare Worker (.mjs). The
  // type-aware rules need a tsconfig covering these and would false-positive on
  // untyped JS, so they get the non-type-checked strict preset instead.
  ...tseslint.configs.strict.map((c) => ({
    ...c,
    files: ['**/*.{js,jsx,mjs,cjs}'],
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
    },
  },

  // ── SonarJS (complexity & bug patterns — SwiftLint cyclomatic_complexity) ─
  sonarjs.configs.recommended,
  {
    rules: {
      // Preset default is 15. This is the single complexity gate; ESLint's core
      // cyclomatic `complexity` rule overlapped it and is intentionally not enabled.
      'sonarjs/cognitive-complexity': ['error', 20],
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
      'max-depth': ['error', 4],
      'max-params': ['error', 5],
      'max-lines': ['error', { max: 700, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 120, skipBlankLines: true, skipComments: true }],
    },
  },

  // ── CommonJS config / scripts / entry ───────────────────────────────────
  // These files are genuinely CommonJS (Metro/ESLint config loaders are CJS,
  // and the Expo entry uses a require to load the router), so `require()` is
  // correct here rather than ESM imports.
  {
    files: ['eslint.config.js', 'metro.config.js', '*.config.js', 'scripts/**/*.js', 'index.ts'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
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
