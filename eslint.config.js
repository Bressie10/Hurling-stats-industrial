import js from '@eslint/js'
import svelte from 'eslint-plugin-svelte'
import globals from 'globals'

export default [
  {
    ignores: [
      '.svelte-kit/**',
      '.vercel/**',
      '.wrangler/**',
      'build/**',
      'coverage/**',
      'ios/App/App/public/**',
      'ios/App/App/build/**',
      'ios/DerivedData/**',
      'android/app/src/main/assets/**',
      'android/**/build/**',
      'node_modules/**',
      'package-lock.json',
    ],
  },
  js.configs.recommended,
  ...svelte.configs['flat/recommended'],
  {
    files: ['**/*.{js,mjs,svelte}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      'no-console': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-useless-assignment': 'off',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['**/*.svelte'],
    rules: {
      'svelte/no-immutable-reactive-statements': 'off',
      'svelte/no-navigation-without-resolve': 'off',
      'svelte/prefer-svelte-reactivity': 'off',
      'svelte/require-each-key': 'off',
    },
  },
  {
    files: ['static/**/*.js'],
    languageOptions: {
      globals: {
        importScripts: 'readonly',
      },
    },
  },
]
