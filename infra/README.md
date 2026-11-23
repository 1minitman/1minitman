# Infrastructure

Hosting decisions are fixed (OD-06, OD-11): Cloudflare free plan at the edge, Railway for the API and
worker (EU West), Neon PostgreSQL + PostGIS and Upstash Redis (Frankfurt), Cloudflare R2 for media.

| Path                                      | What it is                                                                                   |
| ----------------------------------------- | -------------------------------------------------------------------------------------------- |
| `docker/service.Dockerfile`               | Image for the API and the worker (`--build-arg SERVICE=api                                   | worker`). |
| `railway/api.json`, `railway/worker.json` | Railway config-as-code. In each Railway service set "Config file path" to the matching file. |

Not here yet, on purpose: Terraform for Cloudflare, Neon, Upstash and the small AWS footprint. It is
added when the staging environment is created, so nothing describes infrastructure that does not exist.

The local equivalents (PostgreSQL 16 + PostGIS, Redis) are in `docker-compose.yml` at the repo root.
