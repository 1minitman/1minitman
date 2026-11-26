import { describe, expect, test } from 'bun:test';
import { createShutdown } from './shutdown';
import { recordingLogger } from './test-support';

describe('createShutdown()', () => {
  test('a clean stop runs every step in order and exits 0', async () => {
    const order: string[] = [];
    const exits: number[] = [];
    const shutdown = createShutdown({
      logger: recordingLogger(),
      steps: [
        () => Promise.resolve(order.push('queue')),
        () => Promise.resolve(order.push('database')),
      ],
      exit: (code) => void exits.push(code),
    });
    await shutdown('SIGTERM');
    expect(order).toEqual(['queue', 'database']);
    expect(exits).toEqual([0]);
  });

  test('a second signal while stopping is ignored', async () => {
    let stops = 0;
    let release: () => void = () => {};
    const exits: number[] = [];
    const logger = recordingLogger();
    const shutdown = createShutdown({
      logger,
      steps: [() => ((stops += 1), new Promise<void>((resolve) => (release = resolve)))],
      exit: (code) => void exits.push(code),
    });
    const first = shutdown('SIGTERM');
    await shutdown('SIGINT');
    release();
    await first;
    expect(stops).toBe(1);
    expect(exits).toEqual([0]);
    expect(logger.lines.some((l) => l.message === 'shutdown already in progress')).toBe(true);
  });

  test('a rejecting step is logged, never rejects, and exits 1', async () => {
    const exits: number[] = [];
    const logger = recordingLogger();
    const shutdown = createShutdown({
      logger,
      steps: [() => Promise.reject(new Error('connection lost'))],
      exit: (code) => void exits.push(code),
    });
    await expect(shutdown('SIGTERM')).resolves.toBeUndefined();
    expect(exits).toEqual([1]);
    const line = logger.lines.find((l) => l.level === 'error');
    expect(line?.message).toBe('shutdown failed');
    expect(line?.fields?.error).toBe('Error');
    expect(JSON.stringify(logger.lines)).not.toContain('connection lost');
  });
});
