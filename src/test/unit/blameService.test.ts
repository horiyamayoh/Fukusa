import * as assert from 'assert';
import * as vscode from 'vscode';

import { BlameService, WORKTREE_BLAME_CACHE_TTL_MS, bucketizeAge } from '../../application/blameService';
import { BlameLineInfo, RepoContext } from '../../adapters/common/types';

suite('Unit: bucketizeAge', () => {
  test('maps timestamps into age buckets', () => {
    const now = Date.parse('2026-03-14T00:00:00Z');

    assert.strictEqual(bucketizeAge(Date.parse('2026-03-01T00:00:00Z'), now), 0);
    assert.strictEqual(bucketizeAge(Date.parse('2025-12-15T00:00:00Z'), now), 1);
    assert.strictEqual(bucketizeAge(Date.parse('2025-08-01T00:00:00Z'), now), 2);
    assert.strictEqual(bucketizeAge(Date.parse('2024-10-01T00:00:00Z'), now), 3);
    assert.strictEqual(bucketizeAge(Date.parse('2023-01-01T00:00:00Z'), now), 4);
  });

  test('applies TTL only to worktree blame cache entries', async () => {
    const repo: RepoContext = {
      kind: 'git',
      repoRoot: 'c:/repo',
      repoId: 'repo123'
    };
    const blameLines: BlameLineInfo[] = [
      {
        lineNumber: 1,
        revision: 'abcdef12',
        author: 'tester',
        timestamp: Date.parse('2026-03-01T00:00:00Z')
      }
    ];
    const requestedTtls: Array<number | undefined> = [];
    const cacheService = {
      async getOrLoadJson<T>(
        descriptor: unknown,
        loader: () => Promise<T>,
        options?: { readonly maxAgeMs?: number }
      ): Promise<{ readonly value: T; readonly source: 'loader' }> {
        void descriptor;
        requestedTtls.push(options?.maxAgeMs);
        return {
          value: await loader(),
          source: 'loader'
        };
      }
    };
    const repositoryService = {
      async resolveResource(uri: vscode.Uri) {
        return uri.scheme === 'file'
          ? { repo, relativePath: 'sample.ts', originalUri: uri }
          : { repo, relativePath: 'sample.ts', originalUri: uri, revision: 'abcdef12' };
      },
      getAdapter() {
        return {
          async getBlame() {
            return blameLines;
          }
        };
      }
    };

    const service = new BlameService(repositoryService as never, cacheService as never);
    await service.getHeatmap(vscode.Uri.file('c:/repo/sample.ts'));
    await service.getHeatmap(vscode.Uri.parse('multidiff://git/repo123/sample.ts?rev=abcdef12&path=sample.ts'));

    assert.strictEqual(requestedTtls[0], WORKTREE_BLAME_CACHE_TTL_MS);
    assert.strictEqual(requestedTtls[1], undefined);
  });
});
