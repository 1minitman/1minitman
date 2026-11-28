import { afterEach, expect, spyOn, test } from 'bun:test';
import { createLogger, errorLabel } from './logger';

const log = spyOn(console, 'log').mockImplementation(() => undefined);
const error = spyOn(console, 'error').mockImplementation(() => undefined);
afterEach(() => {
  log.mockClear();
  error.mockClear();
});

test('writes one JSON line per event at or above the level', () => {
  const logger = createLogger('info', { service: 'worker' });
  logger.debug('hidden');
  logger.info('shown', { job: 'a.b' });
  logger.warn('careful');
  logger.error('broken');
  expect(log).toHaveBeenCalledTimes(2);
  expect(error).toHaveBeenCalledTimes(1);
  const line = JSON.parse(String(log.mock.calls[0]?.[0])) as Record<string, unknown>;
  expect(line).toMatchObject({ level: 'info', message: 'shown', service: 'worker', job: 'a.b' });
  expect(typeof line.time).toBe('string');
});

test('a child logger adds its fields to every line', () => {
  createLogger('debug').child({ job: 'x.y' }).debug('detail');
  expect(JSON.parse(String(log.mock.calls[0]?.[0]))).toMatchObject({
    level: 'debug',
    job: 'x.y',
  });
});

test('errorLabel() gives a driver code or a name, never the message', () => {
  const quoted = 'invalid input syntax for type uuid: "member@example.com"';
  const pg = Object.assign(new Error(quoted), { code: '22P02' });
  expect(errorLabel(pg)).toBe('22P02');
  expect(errorLabel(new Error(quoted, { cause: { code: 'ECONNREFUSED' } }))).toBe('ECONNREFUSED');
  expect(errorLabel(new TypeError(quoted))).toBe('TypeError');
  expect(errorLabel(quoted)).toBe('unknown');
  expect(errorLabel(null)).toBe('unknown');
});

test('sensitive fields and values never reach the line (MOD-00 behaviour 16)', () => {
  createLogger('info', { service: 'worker' }).warn('send failed for member@example.com', {
    job: 'otp.send',
    phone: '+2348000000000',
    code: '123456',
    payload: { token: 'abc' },
    member_id: 'm-1',
  });
  const raw = String(log.mock.calls[0]?.[0]);
  for (const value of ['member@example.com', '+2348000000000', '123456', 'abc']) {
    expect(raw).not.toContain(value);
  }
  expect(JSON.parse(raw)).toMatchObject({ job: 'otp.send', member_id: 'm-1', code: '[redacted]' });
});
