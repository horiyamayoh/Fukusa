import * as assert from 'assert';
import * as vscode from 'vscode';

import { RepoContext, RevisionRef } from '../../adapters/common/types';
import { RepositoryRegistry } from '../../application/repositoryRegistry';
import { SessionService } from '../../application/sessionService';
import { UriFactory } from '../../infrastructure/fs/uriFactory';

suite('Unit: SessionService', () => {
  const repo: RepoContext = {
    kind: 'git',
    repoRoot: 'c:/repo',
    repoId: 'repo123'
  };
  const revisions: RevisionRef[] = [
    { id: 'a1', shortLabel: 'a1' },
    { id: 'b2', shortLabel: 'b2' },
    { id: 'c3', shortLabel: 'c3' },
    { id: 'd4', shortLabel: 'd4' }
  ];

  test('builds adjacent pairs', () => {
    const service = new SessionService(new UriFactory(new RepositoryRegistry()));
    const pairs = service.buildPairs(repo, 'src/sample.ts', revisions, 'adjacent');

    assert.strictEqual(pairs.length, 3);
    assert.strictEqual(pairs[0].left.revision, 'a1');
    assert.strictEqual(pairs[0].right.revision, 'b2');
    assert.strictEqual(pairs[2].left.revision, 'c3');
    assert.strictEqual(pairs[2].right.revision, 'd4');
  });

  test('builds base pairs', () => {
    const service = new SessionService(new UriFactory(new RepositoryRegistry()));
    const pairs = service.buildPairs(repo, 'src/sample.ts', revisions, 'base');

    assert.strictEqual(pairs.length, 3);
    assert.strictEqual(pairs[0].left.revision, 'a1');
    assert.strictEqual(pairs[2].right.revision, 'd4');
  });

  test('shifts visible window within bounds', () => {
    const service = new SessionService(new UriFactory(new RepositoryRegistry()));
    const session = service.createSession(repo, vscode.Uri.file('c:/repo/src/sample.ts'), 'src/sample.ts', revisions, 'adjacent', 2);

    service.shiftWindow(session.id, 1);
    assert.strictEqual(session.visibleStartPairIndex, 1);

    service.shiftWindow(session.id, 10);
    assert.strictEqual(session.visibleStartPairIndex, 1);
  });

  test('evicts the oldest session when the limit is reached', () => {
    const service = new SessionService(new UriFactory(new RepositoryRegistry()), 2);
    const first = service.createSession(repo, vscode.Uri.file('c:/repo/src/one.ts'), 'src/one.ts', revisions, 'adjacent', 2);
    const second = service.createSession(repo, vscode.Uri.file('c:/repo/src/two.ts'), 'src/two.ts', revisions, 'adjacent', 2);
    const third = service.createSession(repo, vscode.Uri.file('c:/repo/src/three.ts'), 'src/three.ts', revisions, 'adjacent', 2);

    assert.strictEqual(service.getSession(first.id), undefined);
    assert.ok(service.getSession(second.id));
    assert.ok(service.getSession(third.id));
    assert.strictEqual(service.listSessions().length, 2);
  });
});
