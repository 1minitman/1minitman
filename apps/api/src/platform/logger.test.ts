import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import { createLogger } from './logger';

const log = spyOn(console, 'log').mockImplementation(() => {});
const error = spyOn(console, 'error').mockImplementation(() => {});
afterEach(() => {
  log.mockClear();
  error.mockClear();
});

const lines = (spy: typeof log) =>
  spy.mock.calls.map(([line]) => JSON.parse(String(line)) as Record<string, unknown>);

describe('createLogger', () => {
  test('writes one JSON line per event at or above its level', () => {
    const logger = createLogger('info', { service: 'api' });
    logger.debug('hidden');
    logger.info('shown', { status: 200 });
    logger.warn('careful');
    logger.error('broken');
    expect(lines(log).map((l) => [l.level, l.message, l.service])).toEqual([
      ['info', 'shown', 'api'],
      ['warn', 'careful', 'api'],
    ]);
    expect(lines(log)[0]).toMatchObject({ status: 200, time: expect.any(String) });
    expect(lines(error).map((l) => l.message)).toEqual(['broken']);
  });

  test('a child adds its fields to every line', () => {
    createLogger('debug').child({ request_id: 'req_12345678' }).debug('hello');
    expect(lines(log)[0]).toMatchObject({ level: 'debug', request_id: 'req_12345678' });
  });
});

describe('createLogger redaction (MOD-00 behaviour 16)', () => {
  test('no sensitive field or value reaches the line', () => {
    const logger = createLogger('debug', { service: 'api' }).child({ token: 'child-token' });
    logger.error('sign-in failed for member@example.com', {
      password: 'hunter22',
      otp: '123456',
      authorization: 'Bearer abc',
      cookie: 'sid=abc',
      email: 'member@example.com',
      phone: '+2348000000000',
      message_body: 'hello',
      card_number: '4242424242424242',
      face_image: 'base64...',
      status: 401,
    });
    const raw = String(error.mock.calls[0]?.[0]);
    for (const value of [
      'child-token',
      'hunter22',
      '123456',
      'Bearer abc',
      'sid=abc',
      'member@example.com',
      '+2348000000000',
      'hello',
      '4242424242424242',
      'base64',
    ]) {
      expect(raw).not.toContain(value);
    }
    expect(JSON.parse(raw)).toMatchObject({ service: 'api', status: 401, password: '[redacted]' });
  });

  test('the request line keeps method, path, status and duration', () => {
    createLogger('info').info('request', {
      method: 'GET',
      path: '/v1/me',
      status: 200,
      duration_ms: 3,
    });
    expect(lines(log)[0]).toMatchObject({
      method: 'GET',
      path: '/v1/me',
      status: 200,
      duration_ms: 3,
    });
  });
});
