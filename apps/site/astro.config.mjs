// @ts-check
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, envField } from 'astro/config';
import { loadEnv } from 'vite';

// One env file for the whole repo: <root>/.env.development (see .env.example).
const envDir = new URL('../..', import.meta.url).pathname;
const env = loadEnv(
  process.env.NODE_ENV === 'production' ? 'production' : 'development',
  envDir,
  'PUBLIC_',
);

export default defineConfig({
  site: process.env.PUBLIC_SITE_URL ?? env.PUBLIC_SITE_URL ?? 'https://1minitman.com',
  output: 'static',
  server: { port: 4321 },
  // English at the root, /pcm/... and /fr/... beside it (website spec DN-11). Never auto-redirect.
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'pcm', 'fr'],
    routing: { prefixDefaultLocale: false, redirectToDefaultLocale: false },
  },
  // Validated at build time. Only variables declared here exist in pages, and only the
  // `client` + `public` ones may reach the browser. Nothing secret belongs in a static site.
  env: {
    schema: {
      PUBLIC_API_URL: envField.string({ context: 'client', access: 'public', url: true }),
    },
    validateSecrets: true,
  },
  vite: { envDir, plugins: [tailwindcss()] },
});
