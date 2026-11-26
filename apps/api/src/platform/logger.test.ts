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
