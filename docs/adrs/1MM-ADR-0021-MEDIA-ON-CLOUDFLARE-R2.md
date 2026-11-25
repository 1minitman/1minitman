# 1MM-ADR-0021 · Media on Cloudflare R2: private buckets, presigned URLs, quarantine first

|                  |                                                                       |
| ---------------- | --------------------------------------------------------------------- |
| **Status**       | Accepted                                                              |
| **Date decided** | 18 Nov 2026                                                           |
| **Decided by**   | Owner decision OD-11                                                  |
| **Sources**      | [OD-11], [TR §4.3], [TR §5.3], [TR §6.1], [TR §11], [TR §13.1]        |
| **Affects**      | apps/api, apps/worker, apps/mobile, apps/site, MOD-00, MOD-04, MOD-14 |

## Context

Members upload photos, clips and voice notes; the website takes CVs and safety evidence. The
original plan was AWS with CloudFront. OD-11 moved media to "Cloudflare R2 (S3-compatible API,
presigned URLs, no egress fees; EU jurisdiction)" [OD-11]. The security list requires "presigned
uploads with type and size limits; re-encoding strips payloads and EXIF / GPS" [TR §13.1], and
the app rule is that "the app never holds cloud keys" [TR §5.3].

## Decision

1. All media is stored in Cloudflare R2 with EU jurisdiction, through the S3-compatible API.
2. Buckets [TR §4.3]: `media-quarantine` (private, new uploads), `media-originals` (private),
   `media-variants` (private; served by short-lived presigned URLs issued by the API), `exports`
   (7-day lifecycle rule), `backups` (nightly database dumps, 30-day lifecycle).
3. Clients upload straight to R2 with a presigned URL into quarantine [TR §5.3]. Nothing is
   shown from quarantine: the worker job `media.process` re-encodes, strips EXIF and GPS, checks
   and moderates, then moves the asset to active or rejected [TR §11].
4. No bucket is public. Reads use short-lived presigned URLs.
5. Website uploads use the same pattern through `POST /public/v1/uploads` into a quarantine
   prefix, and a file opens in the admin console only after it is marked `clean` [TR §6.1].
6. The upload endpoint and the processing pipeline are built once for every media kind
   (ruling R1, [master plan](../execution/1MM-EXE-00-MASTER-PLAN.md) section 7).

## Alternatives considered

- **AWS S3 with CloudFront** (original T1): replaced when OD-11 removed AWS from everything but
  Rekognition and KMS; R2 has no egress fees [OD-11].
- **Uploading through the API:** the sources record no such option. **Analysis:** it would pass
  large bodies through the API replicas on slow mobile links and against the body-size limits
  [TR §13.1].
- **Public bucket behind the CDN:** not chosen; variants are private and served by presigned
  URLs [TR §4.3].

## Consequences

- Easier: no egress bill for a media-heavy product; the S3 API keeps the code portable [OD-11];
  unprocessed files are never reachable.
- Harder: presigned URLs expire, so clients must re-request them and caching is bounded by the
  URL lifetime; quarantine adds a delay between upload and display; lifecycle rules must be set
  per bucket.
- Cost: R2 storage and operations only.

## How it is applied

- The media and R2 base is a cross-cutting deliverable of
  [MOD-00](../execution/1MM-EXE-MOD-00-FOUNDATIONS.md); `POST /v1/media/upload-url` and
  `media.process` are built in
  [MOD-04](../execution/1MM-EXE-MOD-04-PROFILE-MEDIA-AND-PROMPTS.md); the first public upload in
  [MOD-14](../execution/1MM-EXE-MOD-14-SUPPORT-AND-HELP.md) (ruling R24).
- Buckets are provisioned as infrastructure as code (Terraform for Cloudflare) [TR §4.3].
- Checks: a test that a quarantined object has no readable URL; a test that a processed image
  carries no EXIF; `pnpm check:client-bundles` proves no server-only setting reaches a client
  build.

## Revisit when

The origin moves to AWS af-south-1 (OD-11 growth path), or presigned-URL lifetimes make image
caching on slow networks miss the performance budgets [TR §15].
