// Lint rules follow google/gts: eslint recommended + typescript-eslint, plus
// type-aware checks that catch unhandled promises and unsafe `any` use.
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {ignores: ['plugins/**', '.build/**', 'node_modules/**', 'site/**', 'media-src/**']},
  js.configs.recommended,
  {
    files: ['engine/**/*.ts'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {project: './engine/tsconfig.test.json', tsconfigRootDir: import.meta.dirname},
    },
    rules: {
      eqeqeq: 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'no-restricted-syntax': [
        'error',
        {selector: 'ExportDefaultDeclaration', message: 'Use named exports (Google TS style).'},
      ],
      '@typescript-eslint/array-type': ['error', {default: 'array-simple'}],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/no-unused-vars': ['error', {argsIgnorePattern: '^_'}],
    },
  },
  {
    // node:test's describe() and it() return promises the runner awaits itself.
    files: ['engine/test/**/*.ts'],
    rules: {
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-floating-promises': [
        'error',
        {
          allowForKnownSafeCalls: [
            {from: 'package', name: ['describe', 'it'], package: 'node:test'},
          ],
        },
      ],
    },
  },
  {
    files: ['scripts/**/*.mjs', 'evals/**/*.mjs', 'eslint.config.js'],
    languageOptions: {globals: {...globals.node, ...globals.browser}},
  },
);
