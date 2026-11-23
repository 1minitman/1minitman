import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Workspace boundaries, shared by every rule block below (a later block replaces an earlier
// one for the same rule, so each block that sets no-restricted-imports includes these).
const workspaceBoundaries = [
  {
    regex: '^(\\.\\./)+(apps|packages)/',
    message: 'Import another workspace by its package name (@1minitman/...), not by path.',
  },
  {
    group: ['@1minitman/*/src', '@1minitman/*/src/**', '@1minitman/*/dist/**'],
    message: "Use the package's public exports (see its package.json), not its internal files.",
  },
  {
    group: [
      '@1minitman/api',
      '@1minitman/worker',
      '@1minitman/admin',
      '@1minitman/web',
      '@1minitman/site',
      '@1minitman/mobile',
    ],
    message: 'Apps are deployables: nothing imports an app. Move shared code to a package.',
  },
];

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
    // Workspace boundaries. Packages are used through their package name and declared exports:
    // never by a relative path into another workspace, never by reaching into its src folder,
    // and one app never imports another app.
    files: ['apps/**/*.{ts,tsx}', 'packages/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: workspaceBoundaries,
        },
      ],
    },
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
            ...workspaceBoundaries,
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
            ...workspaceBoundaries,
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
