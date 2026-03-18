import * as assert from 'assert';
import * as vscode from 'vscode';

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

  test('rejects unsupported snapshot authorities', () => {
    const uriFactory = new UriFactory(new RepositoryRegistry());
    const uri = vscode.Uri.parse('multidiff://hg/repo123/src/sample.ts?rev=abcdef12&path=src/sample.ts');

    assert.throws(() => uriFactory.parseSnapshotUri(uri), /Unsupported snapshot URI authority/);
  });

  test('rejects path traversal in snapshot URIs', () => {
    const uriFactory = new UriFactory(new RepositoryRegistry());
    const uri = vscode.Uri.parse('multidiff://git/repo123/src/sample.ts?rev=abcdef12&path=../secret.txt');

    assert.throws(() => uriFactory.parseSnapshotUri(uri), /Invalid snapshot relative path/);
  });

  test('round-trips session URIs', () => {
    const uriFactory = new UriFactory(new RepositoryRegistry());
    const uri = uriFactory.createSessionUri('session-1', 'src/sample.ts');
    const parsed = uriFactory.parseSessionUri(uri);

    assert.strictEqual(parsed.sessionId, 'session-1');
    assert.strictEqual(parsed.relativePath, 'src/sample.ts');
  });
});
