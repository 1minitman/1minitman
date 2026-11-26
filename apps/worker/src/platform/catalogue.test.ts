import { expect, test } from 'bun:test';
import { compareCatalogue } from './catalogue';

test('a registry and manifest that match the catalogue report nothing', () => {
  expect(
    compareCatalogue(['a.one'], [{ name: 'b.two', owner: 'MOD-01' }], ['a.one', 'b.two']),
  ).toEqual({
    unclaimed: [],
    handlersWithoutRow: [],
    pendingWithoutRow: [],
    handledAndPending: [],
    duplicates: [],
  });
});

test('every kind of mismatch is reported', () => {
  const report = compareCatalogue(
    ['a.one', 'x.handler', 'x.handler', 'b.two'],
    [
      { name: 'b.two', owner: 'MOD-01' },
      { name: 'y.pending', owner: 'MOD-02' },
      { name: 'y.pending', owner: 'MOD-02' },
    ],
    ['a.one', 'b.two', 'c.unclaimed'],
  );
  expect(report).toEqual({
    unclaimed: ['c.unclaimed'],
    handlersWithoutRow: ['x.handler', 'x.handler'],
    pendingWithoutRow: ['y.pending', 'y.pending'],
    handledAndPending: ['b.two'],
    duplicates: ['x.handler', 'y.pending'],
  });
});
