# 1minitman

_Don't waste my time._ One repository, all TypeScript: the API, the background worker, the admin
console, the public website, the billing web app and the member app.

```bash
pnpm install
pnpm dev        # database + Redis + API + worker + admin + web + website + Metro, together
```

**Start with [docs/USAGE.md](docs/USAGE.md).** It explains how the parts fit, how to run them and
where every key and account comes from.

## Layout

```
apps/
  api       Hono on Bun        /v1 · /public/v1 · /admin/v1 · /webhooks      -> Railway
  worker    pg-boss on Bun     background jobs                               -> Railway
  admin     Vite + React       staff console (shadcn/ui, TanStack)           -> Cloudflare Pages
  web       Vite + React       billing only (Flutterwave)                    -> Cloudflare Pages
  site      Astro (static)     public website, en / pcm / fr                 -> Cloudflare Pages
  mobile    Expo + NativeWind  member app, iOS and Android                   -> EAS
packages/
  db            schema v3.4, SQL migrations, migration runner, Drizzle client
  contracts     zod schemas, route definitions, typed client generated from OpenAPI
  entitlements  roles, plans, entitlement keys and pure rules
  tokens        brand tokens -> CSS, TypeScript, NativeWind preset
  ui-web        shadcn/ui components on the tokens (admin, web)
  ui-native     NativeWind components on the tokens (mobile)
  i18n          en / pcm / fr catalogues
infra/          Dockerfile and Railway config for the API and worker
assets/         logo pack and illustrations (sources)
docs/           USAGE.md
```

## Order of work

Every feature is built in the same order: **API → admin → website → app.** The API contract comes
first; every client consumes the typed client generated from it.

## Branches

- `develop` is the default branch. All work arrives here by pull request.
- `production` is what is live. It only changes by an approved merge from `develop`.
