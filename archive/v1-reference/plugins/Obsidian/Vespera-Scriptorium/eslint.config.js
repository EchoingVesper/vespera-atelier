// ESLint v9+ configuration file migrated from .eslintrc and .eslintignore
// See: https://eslint.org/docs/latest/use/configure/migration-guide

/** @type {import('eslint').Linter.FlatConfig} */
import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  {
    ignores: [
      'node_modules/',
      'src/main.ts',
    ],
  },
  js.configs.recommended,
  {
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { args: 'none' }],
      '@typescript-eslint/ban-ts-comment': 'off',
      'no-prototype-builtins': 'off',
      '@typescript-eslint/no-empty-function': 'off',
    },
  },
];
