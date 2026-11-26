import { isKeysetId, isKeysetKey, type KeysetKind, type KeysetPosition } from '@1minitman/db';
import { ProblemError } from '../errors';

/*
 * The opaque cursor of a keyset list (MOD-00 plan behaviour 9, rule 7). It is base64url JSON of
 * the position `(sort key, id)`, the direction, and the list and sort that issued it. A cursor is
 * client input: one that does not decode, carries a key of the wrong shape, or was issued by
 * another list or another sort is a 422 `validation` on `cursor`, never a query.
 *
 * The cursor is not signed (GAP-MOD00-22): no source names a signing key. Every field is checked,
 * so an edited cursor can only name a position the caller could reach by paging; row-level
 * security and the list's own filters still decide which rows come back.
 */

/** Longest cursor accepted. A coded limit: positions are short and never need more. */
export const CURSOR_MAX_LENGTH = 1024;
const VERSION = 1;
const BASE64URL = /^[A-Za-z0-9_-]+$/;

interface Payload {
  v: number;
  l: string;
  s: string;
  t: 'n' | 'p';
  k: string;
  i: string;
}

const invalid = (message: string) =>
  new ProblemError('validation', {
    detail: 'The cursor is not valid for this list.',
    errors: [{ path: 'cursor', code: 'invalid_format', message }],
  });

const toBase64Url = (text: string) => Buffer.from(text, 'utf8').toString('base64url');

export interface CursorCodec {
  encode(position: KeysetPosition): string;
  /** Undefined for no cursor (the first page); throws a `validation` ProblemError otherwise. */
  decode(cursor: string | undefined): KeysetPosition | undefined;
}

/**
 * A codec for one list and one sort. `list` names the list (for example `admin.users`) and must
 * differ between lists; `sort` is the sort value of the request; `kind` is that sort's key type.
 */
export const createCursorCodec = (args: {
  list: string;
  sort: string;
  kind: KeysetKind;
}): CursorCodec => {
  const { list, sort, kind } = args;
  return {
    encode: (position) =>
      toBase64Url(
        JSON.stringify({
          v: VERSION,
          l: list,
          s: sort,
          t: position.toward === 'next' ? 'n' : 'p',
          k: position.key,
          i: position.id,
        } satisfies Payload),
      ),
    decode: (cursor) => {
      if (cursor === undefined) return undefined;
      if (cursor.length === 0 || cursor.length > CURSOR_MAX_LENGTH || !BASE64URL.test(cursor)) {
        throw invalid('Cursor is not an opaque cursor issued by this API');
      }
      let payload: unknown;
      try {
        payload = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
      } catch {
        throw invalid('Cursor is not an opaque cursor issued by this API');
      }
      if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
        throw invalid('Cursor is not an opaque cursor issued by this API');
      }
      const p = payload as Partial<Payload>;
      if (Object.keys(p).length !== 6 || p.v !== VERSION) {
        throw invalid('Cursor is not an opaque cursor issued by this API');
      }
      if (p.l !== list) throw invalid('Cursor was issued by another list');
      if (p.s !== sort)
        throw invalid('Cursor was issued for another sort; start from the first page');
      if ((p.t !== 'n' && p.t !== 'p') || !isKeysetKey(kind, p.k) || !isKeysetId(p.i)) {
        throw invalid('Cursor is not an opaque cursor issued by this API');
      }
      return { key: p.k, id: p.i, toward: p.t === 'n' ? 'next' : 'prev' };
    },
  };
};
