import { describe, expect, test } from 'bun:test';
import {
  AdminStreamEventSchema,
  AuthFrameSchema,
  ClientFrameSchema,
  EchoDataSchema,
  ErrorFrameDataSchema,
  EventTypeSchema,
  PresenceHeartbeatDataSchema,
  ReadyFrameDataSchema,
  ServerFrameSchema,
  WS_CLOSE_CODES,
  WS_HEARTBEAT_SECONDS,
} from './realtime';

describe('realtime envelopes', () => {
  test('event names are the dotted lower-case names of the Technical Reference', () => {
    for (const name of ['presence.heartbeat', 'message.new', 'group.message.new', 'echo']) {
      expect(EventTypeSchema.safeParse(name).success).toBe(true);
    }
    for (const name of ['', 'Message.new', 'message.', '.new', 'message..new', 'a'.repeat(65)]) {
      expect(EventTypeSchema.safeParse(name).success).toBe(false);
    }
  });

  test('a client frame has a type, an optional id and optional data, nothing else', () => {
    expect(
      ClientFrameSchema.safeParse({ type: 'echo', id: 'c1', data: { text: 'hi' } }).success,
    ).toBe(true);
    expect(ClientFrameSchema.safeParse({ type: 'presence.heartbeat' }).success).toBe(true);
    expect(ClientFrameSchema.safeParse({ type: 'echo', extra: 1 }).success).toBe(false);
    expect(ClientFrameSchema.safeParse({ type: 'echo', id: '' }).success).toBe(false);
    expect(ClientFrameSchema.safeParse({ data: {} }).success).toBe(false);
  });

  test('the first frame carries the token in data, never anywhere else', () => {
    expect(AuthFrameSchema.safeParse({ type: 'auth', data: { token: 'abc' } }).success).toBe(true);
    expect(AuthFrameSchema.safeParse({ type: 'auth', data: { token: '' } }).success).toBe(false);
    expect(AuthFrameSchema.safeParse({ type: 'auth', data: {} }).success).toBe(false);
    expect(AuthFrameSchema.safeParse({ type: 'echo', data: { token: 'abc' } }).success).toBe(false);
  });

  test('server frames, ready and error payloads', () => {
    expect(ServerFrameSchema.safeParse({ type: 'ready', data: {} }).success).toBe(true);
    expect(ServerFrameSchema.safeParse({ type: 'ready' }).success).toBe(false);
    expect(
      ReadyFrameDataSchema.safeParse({
        connection_id: crypto.randomUUID(),
        heartbeat_seconds: WS_HEARTBEAT_SECONDS,
      }).success,
    ).toBe(true);
    expect(
      ReadyFrameDataSchema.safeParse({ connection_id: 'x', heartbeat_seconds: 30 }).success,
    ).toBe(false);
    expect(
      ErrorFrameDataSchema.safeParse({ code: 'rate_limited', retry_after_seconds: 3 }).success,
    ).toBe(true);
    expect(ErrorFrameDataSchema.safeParse({ code: 'Not-A-Code' }).success).toBe(false);
  });

  test('heartbeat has no payload; echo carries short text', () => {
    expect(PresenceHeartbeatDataSchema.safeParse(undefined).success).toBe(true);
    expect(PresenceHeartbeatDataSchema.safeParse({}).success).toBe(true);
    expect(PresenceHeartbeatDataSchema.safeParse({ state: 'x' }).success).toBe(false);
    expect(EchoDataSchema.safeParse({ text: 'hi' }).success).toBe(true);
    expect(EchoDataSchema.safeParse({ text: 'x'.repeat(257) }).success).toBe(false);
  });

  test('close codes are distinct and application codes sit in 4000-4999', () => {
    const codes = Object.values(WS_CLOSE_CODES);
    expect(new Set(codes).size).toBe(codes.length);
    for (const [reason, code] of Object.entries(WS_CLOSE_CODES)) {
      if (reason !== 'going_away') expect(code >= 4000 && code <= 4999).toBe(true);
    }
  });

  test('an admin stream event has a type, data and a timestamp', () => {
    expect(
      AdminStreamEventSchema.safeParse({
        type: 'queue.counts',
        data: { reports: 3 },
        at: '2026-11-26T10:00:00Z',
      }).success,
    ).toBe(true);
    expect(AdminStreamEventSchema.safeParse({ type: 'queue.counts', data: {} }).success).toBe(
      false,
    );
  });
});
