import { SURFACE_NAMES } from '@1minitman/contracts';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildOpenApiDocument, type AppDeps } from '../app';
import { denyAllAuth } from '../platform/auth';
import { createMemoryIdempotencyStore } from '../platform/idempotency';
import { createLogger } from '../platform/logger';
import {
  createMemoryRateLimiter,
  createPolicyStore,
  staticPolicySource,
} from '../platform/rate-limit';

// Writes one OpenAPI document per surface into packages/contracts/openapi/.
// Needs no database or Redis: documents are built from route definitions alone.
const deps: AppDeps = {
  env: {
    APP_ENV: 'local',
    APP_VERSION: process.env.APP_VERSION ?? '0.1.0',
    CORS_ALLOWED_ORIGINS: [],
  },
  logger: createLogger('error'),
  surfaces: {
    rateLimits: {
      policies: createPolicyStore(staticPolicySource([])),
      limiter: createMemoryRateLimiter(),
    },
    auth: denyAllAuth(),
    idempotency: createMemoryIdempotencyStore(),
  },
  checkReadiness: () => {
    throw new Error('not available while emitting documents');
  },
};

const outDir = join(import.meta.dirname, '../../../../packages/contracts/openapi');
mkdirSync(outDir, { recursive: true });
for (const surface of SURFACE_NAMES) {
  const file = join(outDir, `${surface}.json`);
  writeFileSync(file, `${JSON.stringify(buildOpenApiDocument(deps, surface), null, 2)}\n`);
  console.log(`wrote ${file}`);
}
