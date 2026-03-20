import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';

import { IRepositoryAdapter } from '../../adapters/common/repositoryAdapter';
import { RepoContext } from '../../adapters/common/types';
import { RepositoryRegistry } from '../../application/repositoryRegistry';
import { RepositoryService } from '../../application/repositoryService';
import { UriFactory } from '../../infrastructure/fs/uriFactory';

suite('Unit: RepositoryService', () => {
  const repo: RepoContext = {
    kind: 'git',
    repoRoot: path.join('c:', 'repo'),
    repoId: 'repo123'
  };

  test('returns the registered adapter for a repository kind', () => {
    const service = createService([
      createAdapter('git'),
      createAdapter('svn')
    ]);

    assert.strictEqual(service.getAdapter('git').kind, 'git');
    assert.strictEqual(service.getAdapter('svn').kind, 'svn');
  });

  test('throws when no adapter is registered for the requested kind', () => {
    const service = createService([createAdapter('git')]);

    assert.throws(() => service.getAdapter('svn'), /Repository adapter not registered for svn/);
  });

  test('resolves file resources via the first adapter that claims the path', async () => {
    const targetUri = vscode.Uri.file(path.join(repo.repoRoot, 'src', 'nested', 'sample.ts'));
    const service = createService([
      createAdapter('git', async () => repo),
      createAdapter('svn')
    ]);

    const resource = await service.resolveResource(targetUri);

    assert.deepStrictEqual(resource, {
      repo,
      relativePath: 'src/nested/sample.ts',
      originalUri: targetUri
    });
  });

  test('resolves multidiff snapshot resources from the registry', async () => {
    const registry = new RepositoryRegistry();
    const uriFactory = new UriFactory(registry);
    const service = new RepositoryService([createAdapter('git')], registry, uriFactory);
    registry.register(repo);
    const snapshotUri = uriFactory.createSnapshotUri(repo, 'src/sample.ts', 'rev-2');

    const resource = await service.resolveResource(snapshotUri);

    assert.deepStrictEqual(resource, {
      repo,
      relativePath: 'src/sample.ts',
      originalUri: snapshotUri,
      revision: 'rev-2'
    });
  });

  test('returns undefined for multidiff snapshots whose repository is not registered', async () => {
    const service = createService([createAdapter('git')]);
    const snapshotUri = vscode.Uri.from({
      scheme: 'multidiff',
      authority: 'git',
      path: '/missing-repo/src/sample (rev-1).ts',
      query: 'rev=rev-1&path=src%2Fsample.ts'
    });

    const resource = await service.resolveResource(snapshotUri);

    assert.strictEqual(resource, undefined);
  });
});

function createService(adapters: readonly IRepositoryAdapter[]): RepositoryService {
  return new RepositoryService(adapters, new RepositoryRegistry(), new UriFactory(new RepositoryRegistry()));
}

function createAdapter(
  kind: 'git' | 'svn',
  resolveRepoContext: (uri: vscode.Uri) => Promise<RepoContext | undefined> = async () => undefined
): IRepositoryAdapter {
  return {
    kind,
    resolveRepoContext,
    getHistory: async () => [],
    getSnapshot: async () => new Uint8Array(),
    getBlame: async () => [],
    getDiff: async () => '',
    materializeRevisionTree: async () => undefined
  };
}
