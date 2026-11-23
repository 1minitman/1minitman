## What and why

<!-- One or two sentences. Name the spec module if there is one (A12, W22, flow row 7…). -->

## Order of work

Every feature lands API first, then admin, then website, then app.

- [ ] API: route + contract (`pnpm contracts:generate` run)
- [ ] Admin console
- [ ] Website
- [ ] Member app
- [ ] Not applicable to the unticked surfaces

## Checks

- [ ] `pnpm check` passes locally
- [ ] Database change ships as a new numbered migration (no applied file edited)
- [ ] No secrets, no real member data
