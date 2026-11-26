import { afterEach, expect, spyOn, test } from 'bun:test';
import { createLogger } from './logger';

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
