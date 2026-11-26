import type { Router } from '../http/router';
import { problemResponse } from '../http/problem';
import { WebhookStoreUnavailableError, type WebhookIntake } from './intake';

/**
 * `POST /webhooks/<path>` for every registered vendor [TR §8.2], [1MM-STD-13 §4.7]. Not an
 * OpenAPI operation: vendors are the callers and webhooks are in no client SDK (1MM-ADR-0004).
 * A processing failure is never answered with a 4xx, since a 4xx tells most vendors to stop
 * retrying; only a missing or invalid signature (401) or an unreadable body (400) is.
 */
export const mountWebhookRoutes = (router: Router, intake: WebhookIntake): Router => {
  router.post('/:vendor', async (c) => {
    const vendor = intake.vendorFor(c.req.param('vendor'));
    if (!vendor) return problemResponse(c, 'not_found');

    let rawBody: Uint8Array;
    try {
      rawBody = new Uint8Array(await c.req.arrayBuffer());
    } catch {
      return problemResponse(c, 'bad_request', { detail: 'The request body could not be read' });
    }

    try {
      const outcome = await intake.receive(vendor, { rawBody, headers: c.req.raw.headers });
      switch (outcome.kind) {
        case 'invalid_signature':
          return problemResponse(c, 'webhook_signature_invalid');
        case 'unreadable':
          return problemResponse(c, 'bad_request', { detail: 'The body is not a valid event' });
        default:
          // accepted, ignored and duplicate: the same 200 every time.
          return c.json({ received: true }, 200);
      }
    } catch (error) {
      if (error instanceof WebhookStoreUnavailableError) {
        return problemResponse(c, 'dependency_unavailable');
      }
      throw error;
    }
  });
  return router;
};
