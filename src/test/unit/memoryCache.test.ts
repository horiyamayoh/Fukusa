import * as assert from 'assert';

import { MemoryCache } from '../../infrastructure/cache/memoryCache';

suite('Unit: MemoryCache', () => {
  test('stores and retrieves values', () => {
    const cache = new MemoryCache(1024);
    cache.set('a', 'binary', new Uint8Array([1, 2, 3]), {
      key: 'a',
      namespace: 'snapshot',
      repoId: 'git:repo',
      relativePath: 'a.ts',
      size: 3,
      updatedAt: 1
    });

    const entry = cache.get('a');
    assert.ok(entry);
    assert.deepStrictEqual(Array.from(entry?.value as Uint8Array), [1, 2, 3]);
  });

  test('evicts least recently used entries when capacity is exceeded', () => {
    const cache = new MemoryCache(4);
    cache.set('a', 'binary', new Uint8Array([1, 2]), {
      key: 'a',
      namespace: 'snapshot',
      repoId: 'git:repo',
      relativePath: 'a.ts',
      size: 2,
      updatedAt: 1
    });
    cache.set('b', 'binary', new Uint8Array([3, 4]), {
      key: 'b',
      namespace: 'snapshot',
      repoId: 'git:repo',
      relativePath: 'b.ts',
      size: 2,
      updatedAt: 1
    });
    cache.get('b');
    cache.set('c', 'binary', new Uint8Array([5, 6]), {
      key: 'c',
      namespace: 'snapshot',
      repoId: 'git:repo',
      relativePath: 'c.ts',
      size: 2,
      updatedAt: 1
    });

    assert.strictEqual(cache.get('a'), undefined);
    assert.ok(cache.get('b'));
    assert.ok(cache.get('c'));
  });
});
