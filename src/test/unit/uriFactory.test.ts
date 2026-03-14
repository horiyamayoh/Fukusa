import * as assert from 'assert';

import { RepoContext } from '../../adapters/common/types';
import { RepositoryRegistry } from '../../application/repositoryRegistry';
import { UriFactory } from '../../infrastructure/fs/uriFactory';

suite('Unit: UriFactory', () => {
  test('round-trips snapshot URIs', () => {
    const registry = new RepositoryRegistry();
    const uriFactory = new UriFactory(registry);
    const repo: RepoContext = {
      kind: 'git',
      repoRoot: 'c:/repo',
      repoId: 'repo123'
    };

    const uri = uriFactory.createSnapshotUri(repo, 'src/sample.ts', 'abcdef123456');
    const parsed = uriFactory.parseSnapshotUri(uri);

    assert.strictEqual(parsed.kind, 'git');
    assert.strictEqual(parsed.repoId, 'repo123');
    assert.strictEqual(parsed.relativePath, 'src/sample.ts');
    assert.strictEqual(parsed.revision, 'abcdef123456');
  });
});
