import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

import { BlameLineInfo, RepoContext } from '../../adapters/common/types';
import { CacheService } from '../../application/cacheService';
import { createBlameCacheKey } from '../../infrastructure/cache/cacheKeys';
import { MemoryCache } from '../../infrastructure/cache/memoryCache';
import { PersistentCache } from '../../infrastructure/cache/persistentCache';
import { OutputLogger } from '../../util/output';

suite('Unit: CacheService', () => {
  test('reloads stale entries when maxAgeMs is exceeded', async () => {
    const storageDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fukusa-cache-service-'));
    const output = new OutputLogger('CacheService Test');
    const memoryCache = new MemoryCache(1024 * 1024);
    const persistentCache = new PersistentCache(vscode.Uri.file(storageDir));
    const cacheService = new CacheService(memoryCache, persistentCache, output);
    const repo: RepoContext = {
      kind: 'git',
      repoRoot: 'c:/repo',
      repoId: 'repo123'
    };
    const descriptor = createBlameCacheKey(repo, 'src/sample.ts');
    const staleValue: BlameLineInfo[] = [{ lineNumber: 1, revision: 'aaaa1111', author: 'old' }];
    const freshValue: BlameLineInfo[] = [{ lineNumber: 1, revision: 'bbbb2222', author: 'new' }];
    const staleMetadata = {
      key: descriptor.key,
      namespace: descriptor.namespace,
      repoId: descriptor.repoId,
      relativePath: descriptor.relativePath,
      size: Buffer.byteLength(JSON.stringify(staleValue), 'utf8'),
      updatedAt: Date.now() - 5 * 60 * 1000
    };

    memoryCache.set(descriptor.key, 'json', staleValue, staleMetadata);
    await persistentCache.set(descriptor.key, 'json', staleValue, staleMetadata);

    let loadCount = 0;
    const result = await cacheService.getOrLoadJson(
      descriptor,
      async () => {
        loadCount += 1;
        return freshValue;
      },
      { maxAgeMs: 60 * 1000 }
    );

    assert.strictEqual(loadCount, 1);
    assert.strictEqual(result.source, 'loader');
    assert.strictEqual(result.value[0].revision, 'bbbb2222');

    const persisted = await persistentCache.get(descriptor.key);
    assert.ok(persisted);
    assert.strictEqual((persisted!.value as BlameLineInfo[])[0].revision, 'bbbb2222');

    output.dispose();
    await fs.rm(storageDir, { recursive: true, force: true });
  });
});
