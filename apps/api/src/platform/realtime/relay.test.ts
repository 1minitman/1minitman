import { describe, expect, test } from 'bun:test';
import { createLogger } from '../logger';
import { createRedisRelay, type RelaySubscriber } from './relay';

const logger = createLogger('error');

/** A subscriber whose SUBSCRIBE answers only when the test says so, recording every command. */
const fakeSubscriber = () => {
  const commands: string[] = [];
  const answers: { resolve: () => void; reject: (error: Error) => void }[] = [];
  const subscriber = {
    onconnect: null,
    subscribe: (channel: string) => {
      commands.push(`SUBSCRIBE ${channel}`);
      return new Promise<number>((resolve, reject) => {
        answers.push({ resolve: () => resolve(1), reject });
      });
    },
    unsubscribe: (channel: string) => {
      commands.push(`UNSUBSCRIBE ${channel}`);
      return Promise.resolve();
    },
  } as unknown as RelaySubscriber;
  return { subscriber, commands, answers };
};
const publisher = { publish: () => Promise.resolve(1) };

describe('redis relay', () => {
  test('a SUBSCRIBE that does not answer in time rejects and is undone', async () => {
    const { subscriber, commands } = fakeSubscriber();
    const relay = createRedisRelay({ subscriber, publisher, logger, timeoutMs: 5 });
    await expect(relay.join('ch:test', () => {})).rejects.toThrow(
      'realtime subscribe timed out after 5 ms',
    );
    expect(commands).toEqual(['SUBSCRIBE ch:test', 'UNSUBSCRIBE ch:test']);
    expect(relay.channels()).toEqual([]);
  });

  test('a second join waits for the first SUBSCRIBE and shares one subscription', async () => {
    const { subscriber, commands, answers } = fakeSubscriber();
    const relay = createRedisRelay({ subscriber, publisher, logger, timeoutMs: 1_000 });
    let second = false;
    const first = relay.join('ch:test', () => {});
    const other = relay.join('ch:test', () => {}).then(() => (second = true));
    await Bun.sleep(1);
    expect(second).toBe(false);
    answers[0]!.resolve();
    await Promise.all([first, other]);
    expect(second).toBe(true);
    expect(commands).toEqual(['SUBSCRIBE ch:test']);
  });

  test('a failed SUBSCRIBE fails every join waiting on it and leaves no listener behind', async () => {
    const { subscriber, answers } = fakeSubscriber();
    const relay = createRedisRelay({ subscriber, publisher, logger, timeoutMs: 1_000 });
    const first = relay.join('ch:test', () => {});
    const other = relay.join('ch:test', () => {});
    const settled = Promise.allSettled([first, other]);
    await Bun.sleep(1);
    answers[0]!.reject(new Error('redis down'));
    const outcomes = await settled;
    expect(outcomes.map((outcome) => outcome.status)).toEqual(['rejected', 'rejected']);
    expect(relay.channels()).toEqual([]);
  });
});
