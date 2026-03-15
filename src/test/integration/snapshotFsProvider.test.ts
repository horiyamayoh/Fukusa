import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as vscode from 'vscode';

import { IRepositoryAdapter } from '../../adapters/common/repositoryAdapter';
import { RepoContext, RevisionRef } from '../../adapters/common/types';
import { CacheService } from '../../application/cacheService';
import { RepositoryRegistry } from '../../application/repositoryRegistry';
import { RepositoryService } from '../../application/repositoryService';
import { MemoryCache } from '../../infrastructure/cache/memoryCache';
import { PersistentCache } from '../../infrastructure/cache/persistentCache';
import { SnapshotFsProvider } from '../../infrastructure/fs/snapshotFsProvider';
import { UriFactory } from '../../infrastructure/fs/uriFactory';
import { OutputLogger } from '../../util/output';
import { createTempDir } from '../helpers/repoHelpers';

suite('Integration: SnapshotFsProvider', () => {
  class FakeAdapter implements IRepositoryAdapter {
    public readonly kind = 'git' as const;
    public readCount = 0;

    public async resolveRepoContext(): Promise<RepoContext | undefined> {
      return undefined;
    }

    public async getHistory(): Promise<RevisionRef[]> {
      return [];
    }

    public async getSnapshot(): Promise<Uint8Array> {
      this.readCount += 1;
      return new Uint8Array(Buffer.from('export const cached = true;\n', 'utf8'));
    }

    public async getBlame(): Promise<never[]> {
      return [];
    }

    public async getDiff(): Promise<string> {
      return '';
    }
  }

  test('reads snapshots through adapter and cache layers', async () => {
    const storageDir = await createTempDir('fukusa-cache-');
    await fs.mkdir(storageDir, { recursive: true });

    const output = new OutputLogger('SnapshotFsProvider Test');
    const registry = new RepositoryRegistry();
    const uriFactory = new UriFactory(registry);
    const adapter = new FakeAdapter();
    const repositoryService = new RepositoryService([adapter], registry, uriFactory);
    const repo: RepoContext = {
      kind: 'git',
      repoRoot: 'c:/repo',
      repoId: 'repo123'
    };

    const cacheService1 = new CacheService(
      new MemoryCache(1024 * 1024),
      new PersistentCache(vscode.Uri.file(storageDir)),
      output
    );
    const provider1 = new SnapshotFsProvider(repositoryService, uriFactory, cacheService1, output);
    const uri = uriFactory.createSnapshotUri(repo, 'src/sample.ts', 'rev1');

    const initialStat = await provider1.stat(uri);
    assert.strictEqual(initialStat.size, 0);
    assert.strictEqual(adapter.readCount, 0);

    const firstRead = await provider1.readFile(uri);
    assert.match(Buffer.from(firstRead).toString('utf8'), /cached = true/);
    assert.strictEqual(adapter.readCount, 1);

    const secondRead = await provider1.readFile(uri);
    assert.strictEqual(Buffer.from(secondRead).toString('utf8'), Buffer.from(firstRead).toString('utf8'));
    assert.strictEqual(adapter.readCount, 1);

    const cacheService2 = new CacheService(
      new MemoryCache(1024 * 1024),
      new PersistentCache(vscode.Uri.file(storageDir)),
      output
    );
    const provider2 = new SnapshotFsProvider(repositoryService, uriFactory, cacheService2, output);
    const stat = await provider2.stat(uri);
    assert.strictEqual(stat.size, 0);
    assert.strictEqual(adapter.readCount, 1);

    const thirdRead = await provider2.readFile(uri);
    assert.strictEqual(Buffer.from(thirdRead).toString('utf8'), Buffer.from(firstRead).toString('utf8'));
    assert.strictEqual(adapter.readCount, 1);

    output.dispose();
    await fs.rm(storageDir, { recursive: true, force: true });
  });
});
