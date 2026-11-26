import { createHmac } from 'node:crypto';
import type { WebhookProvider } from '@1minitman/db/schema';
import { constantTimeEqual, type WebhookVendor } from './vendor';

// A vendor port for tests only (MOD-00 plan task 14: "Rule 11 covered with a fake vendor"). It
// signs the raw body with HMAC-SHA256 in `X-Test-Signature`; the body is JSON
// `{ "id": ..., "type": ..., "data": ... }`. It stands for no real vendor's scheme.

export const FAKE_SIGNATURE_HEADER = 'X-Test-Signature';

export const signFake = (secret: string, body: string) =>
  createHmac('sha256', secret).update(body).digest('hex');

export const createFakeVendor = (options: {
  secret: string;
  path: string;
  provider?: WebhookProvider;
  handled?: readonly string[];
}): WebhookVendor => ({
  provider: options.provider ?? 'carrier',
  path: options.path,
  verify: ({ rawBody, headers }) => {
    const given = headers.get(FAKE_SIGNATURE_HEADER);
    if (!given) return false;
    return constantTimeEqual(
      given,
      createHmac('sha256', options.secret).update(rawBody).digest('hex'),
    );
  },
  parse: ({ rawBody }) => {
    const body = JSON.parse(new TextDecoder().decode(rawBody)) as Record<string, unknown>;
    if (typeof body.id !== 'string' || typeof body.type !== 'string') return null;
    return { eventId: body.id, eventType: body.type, payload: body };
  },
  handles: (type) => (options.handled ?? ['thing.happened']).includes(type),
});
