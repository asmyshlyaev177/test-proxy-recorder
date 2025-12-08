import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import sonarjs from 'eslint-plugin-sonarjs';
import unicorn from 'eslint-plugin-unicorn';

export default [
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      sonarjs,
      unicorn,
      'simple-import-sort': simpleImportSort,
      prettier: prettierPlugin,
    },
    rules: {
      // TypeScript ESLint
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
      'no-console': 'off',
      'prefer-const': 'error',

      // SonarJS
      ...sonarjs.configs.recommended.rules,

      'sonarjs/cognitive-complexity': ["error", 7],
      // Unicorn - use recommended config
      ...unicorn.configs.recommended.rules,
      // Override specific rules
      'unicorn/filename-case': 'off', // Allow flexibility in file naming
      'unicorn/prevent-abbreviations': 'off', // Too strict for common abbreviations
      'unicorn/no-null': 'off', // null is valid in many APIs and interfaces
      'unicorn/no-process-exit': 'off', // Allowed in CLI tools
      'unicorn/no-array-reduce': 'off',
      'unicorn/prefer-at': 'off',
      'unicorn/prefer-ternary': 'warn',
      'unicorn/prefer-array-find': 'warn',
      'unicorn/no-negated-condition': 'off',
      'unicorn/no-array-sort': 'warn',
      'unicorn/no-array-for-each': 'warn',
      'sonarjs/hashing': 'off',
      'sonarjs/no-unused-vars': 'off',
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          "args": "all",
          "argsIgnorePattern": "^_",
          "caughtErrors": "all",
          "caughtErrorsIgnorePattern": "^_",
          "destructuredArrayIgnorePattern": "^_",
          "varsIgnorePattern": "^_",
          "ignoreRestSiblings": true
        }
      ],

      // Simple Import Sort
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',

      // Prettier - must be last
      ...prettierConfig.rules,
      'prettier/prettier': [
        'warn',
        { singleQuote: true },
        { usePrettierrc: false },
      ],
    },
  },
  // Test file overrides
  {
    files: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    rules: {
      'sonarjs/no-nested-functions': 'off', // Tests often have nested functions
      'sonarjs/assertions-in-tests': 'off', // Some tests check for errors/side effects
      'unicorn/consistent-function-scoping': 'off'
    },
  },
  // ProxyServer has complex event handling with necessary nesting
  {
    files: ['src/ProxyServer.ts'],
    rules: {
      'sonarjs/no-nested-functions': 'off', // Event handlers require nesting
    },
  },
];
