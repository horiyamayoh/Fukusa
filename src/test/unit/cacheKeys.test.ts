import * as assert from 'assert';

import { RepoContext } from '../../adapters/common/types';
import { createBlameCacheKey, createDiffCacheKey, createHistoryCacheKey, createSnapshotCacheKey } from '../../infrastructure/cache/cacheKeys';

suite('Unit: cacheKeys', () => {
  test('produces unique keys per namespace and revision', () => {
    const repo: RepoContext = {
      kind: 'git',
      repoRoot: 'c:/repo',
      repoId: 'abc'
    };

    const keys = new Set([
      createSnapshotCacheKey(repo, 'src/a.ts', '1').key,
      createSnapshotCacheKey(repo, 'src/a.ts', '2').key,
      createHistoryCacheKey(repo, 'src/a.ts', 10).key,
      createBlameCacheKey(repo, 'src/a.ts', '1').key,
      createDiffCacheKey(repo, 'src/a.ts', '1', '2').key
    ]);

    assert.strictEqual(keys.size, 5);
  });
});
