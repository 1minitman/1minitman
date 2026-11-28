import { describe, expect, test } from 'bun:test';
import { isSensitiveKey, REDACTED, redactFields, redactText } from './redact';

describe('isSensitiveKey', () => {
  test.each([
    'password',
    'new_password',
    'code',
    'otp',
    'recovery_code',
    'verificationCode',
    'token',
    'access_token',
    'refreshToken',
    'id_token',
    'authorization',
    'Authorization',
    'cookie',
    'Set-Cookie',
    'secret',
    'client_secret',
    'api_key',
    'apiKey',
    'x-api-key',
    'private_key',
    'email',
    'emailAddress',
    'phone',
    'phone_e164',
    'body',
    'message_body',
    'request_body',
    'face_image',
    'selfie',
    'card_number',
    'cvv',
    'pan',
    'birth_date',
    'dob',
    'latitude',
    'lng',
    'location',
    'query',
    'query_string',
    'payload',
    'vendor_payload',
  ])('%s is dropped', (key) => {
    expect(isSensitiveKey(key)).toBe(true);
  });

  test.each([
    'request_id',
    'member_id',
    'phone_number_id',
    'otp_challenge_id',
    'card_ids',
    'codes_count',
    'status',
    'reason',
    'method',
    'path',
    'duration_ms',
    'policy',
    'job',
    'provider',
    'event',
    'key',
    'idempotency_key',
    'error',
    'message',
  ])('%s is kept', (key) => {
    expect(isSensitiveKey(key)).toBe(false);
  });
});

describe('redactText', () => {
  test('scrubs bearer credentials, JSON Web Tokens and e-mail addresses', () => {
    // Built from parts so secret scanners do not read the fixture as a real token.
    const jwt = ['eyJhbGciOiJFZERTQSJ9', 'eyJzdWIiOiJtZW1iZXIifQ', 'c2lnbmF0dXJl'].join('.');
    expect(redactText(`Authorization: Bearer abc.def-123`)).toBe(
      `Authorization: Bearer ${REDACTED}`,
    );
    expect(redactText(`token ${jwt} refused`)).toBe(`token ${REDACTED} refused`);
    expect(redactText('no account for someone@example.com')).toBe(`no account for ${REDACTED}`);
  });

  test('leaves ordinary text alone', () => {
    const text = 'rate limiter unavailable, allowing request (fail open)';
    expect(redactText(text)).toBe(text);
  });
});

describe('redactFields', () => {
  test('drops sensitive fields at any depth and keeps the rest', () => {
    const input = {
      request_id: 'req_12345678',
      status: 401,
      password: 'hunter22',
      headers: { authorization: 'Bearer x', 'content-type': 'application/json' },
      attempts: [{ code: '123456', at: 'now' }],
      vendor: { response: { access_token: 't', status: 'ok' } },
    };
    expect(redactFields(input)).toEqual({
      request_id: 'req_12345678',
      status: 401,
      password: REDACTED,
      headers: { authorization: REDACTED, 'content-type': 'application/json' },
      attempts: [{ code: REDACTED, at: 'now' }],
      vendor: { response: { access_token: REDACTED, status: 'ok' } },
    });
    expect(input.password).toBe('hunter22');
  });

  test('scrubs text inside kept fields, errors included', () => {
    const out = redactFields({
      error: 'no member with email a.b@example.org',
      cause: new Error('Bearer secret-value rejected'),
    });
    expect(out).toEqual({
      error: `no member with email ${REDACTED}`,
      cause: { name: 'Error', message: `Bearer ${REDACTED} rejected` },
    });
  });

  test('survives cycles and very deep values', () => {
    const cyclic: Record<string, unknown> = { id: '1' };
    cyclic.self = cyclic;
    expect(redactFields({ cyclic })).toEqual({ cyclic: { id: '1', self: '[circular]' } });

    let deep: Record<string, unknown> = { leaf: true };
    for (let i = 0; i < 20; i += 1) deep = { next: deep };
    expect(JSON.stringify(redactFields(deep))).toContain('[truncated]');
  });

  test('walks class instances and toJSON() results, not only plain objects', () => {
    class VendorReply {
      constructor(
        readonly status: string,
        readonly access_token: string,
      ) {}
    }
    const wrapped = { toJSON: () => ({ password: 'hunter22', ok: true }) };
    const out = redactFields({ reply: new VendorReply('ok', 't0ken'), wrapped });
    expect(out).toEqual({
      reply: { status: 'ok', access_token: REDACTED },
      wrapped: { password: REDACTED, ok: true },
    });
    expect(JSON.stringify(out)).not.toContain('hunter22');
    expect(JSON.stringify(out)).not.toContain('t0ken');
  });

  test('keeps numbers, booleans, null and dates as they are', () => {
    const at = new Date(0);
    expect(redactFields({ n: 1, b: false, z: null, at })).toEqual({ n: 1, b: false, z: null, at });
  });
});
