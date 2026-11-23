import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.turbo/**',
      '**/.astro/**',
      '**/.expo/**',
      '**/*.gen.ts',
      'packages/contracts/src/generated/**',
      'packages/db/.introspected/**',
      // Astro files are checked by `astro check` (pnpm typecheck).
      '**/*.astro',
      'apps/mobile/*.config.js',
      'apps/mobile/expo-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': 'off',
    },
  },
  {
    files: ['apps/{admin,web,mobile}/**/*.{ts,tsx}', 'packages/ui-*/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    // Architecture rule: a module is used through its index, never through its inner folders.
    files: ['apps/api/src/**/*.ts'],
    ignores: ['apps/api/src/modules/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/modules/*/*/**'],
              message: "Import from the module's index (modules/<name>), not from inside it.",
            },
          ],
        },
      ],
    },
  },
  {
    // Clean architecture: domain and application code never import HTTP or infrastructure.
    files: ['apps/api/src/modules/*/domain/**/*.ts', 'apps/api/src/modules/*/application/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'hono',
                'hono/*',
                '@hono/*',
                'drizzle-orm',
                'drizzle-orm/*',
                'postgres',
                'bun',
                '**/infrastructure/**',
                '**/http/**',
              ],
              message:
                'Domain and application layers depend on ports only, never on frameworks or adapters.',
            },
          ],
        },
      ],
    },
  },
  prettier,
);
