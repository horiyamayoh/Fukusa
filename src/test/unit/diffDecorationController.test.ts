import * as assert from 'assert';
import * as vscode from 'vscode';

import { NWayCompareSession, RepoContext } from '../../adapters/common/types';
import { RepositoryRegistry } from '../../application/repositoryRegistry';
import { SessionAlignmentService } from '../../application/sessionAlignmentService';
import { UriFactory } from '../../infrastructure/fs/uriFactory';
import { buildRevisionDecorationModels } from '../../presentation/native/diffDecorationController';

suite('Unit: DiffDecorationController', () => {
  test('builds edge markers for all visible adjacent pairs and detailed highlights for the active pair', () => {
    const alignment = new SessionAlignmentService().buildState([
      createSource(0, 'A', 'one\ntwo'),
      createSource(1, 'B', 'one\nTWO'),
      createSource(2, 'C', 'one\nTHREE')
    ]);

    const session = createSession(alignment);
    const models = buildRevisionDecorationModels(session, 0, 2, '1:2');

    assert.deepStrictEqual(models.get(0)?.nextPairEdges.map((entry) => entry.range.start.line), [1]);
    assert.deepStrictEqual(models.get(1)?.previousPairEdges.map((entry) => entry.range.start.line), [1]);
    assert.deepStrictEqual(models.get(1)?.nextPairEdges.map((entry) => entry.range.start.line), [1]);
    assert.deepStrictEqual(models.get(2)?.previousPairEdges.map((entry) => entry.range.start.line), [1]);
    assert.deepStrictEqual(models.get(1)?.modifiedLines.map((entry) => entry.range.start.line), [1]);
    assert.deepStrictEqual(models.get(2)?.modifiedLines.map((entry) => entry.range.start.line), [1]);
    assert.strictEqual(models.get(0)?.modifiedLines.length ?? 0, 0);
  });

  test('uses global row numbers for placeholder rows in aligned compare documents', () => {
    const alignment = new SessionAlignmentService().buildState([
      createSource(0, 'A', 'top\nshared'),
      createSource(1, 'B', 'shared'),
      createSource(2, 'C', 'top\nshared')
    ]);

    const session = createSession(alignment);
    const models = buildRevisionDecorationModels(session, 0, 2, '0:1');

    assert.deepStrictEqual(models.get(1)?.previousPairEdges.map((entry) => entry.range.start.line), [0]);
    assert.deepStrictEqual(models.get(2)?.previousPairEdges.map((entry) => entry.range.start.line), [0]);
  });
});

function createSource(revisionIndex: number, revisionId: string, text: string) {
  return {
    revisionIndex,
    revisionId,
    revisionLabel: revisionId,
    relativePath: 'src/sample.ts',
    snapshotUri: vscode.Uri.file(`c:/repo/${revisionId}.snapshot.ts`),
    rawUri: vscode.Uri.file(`c:/repo/${revisionId}.raw.ts`),
    text
  };
}

function createSession(alignment: ReturnType<SessionAlignmentService['buildState']>): NWayCompareSession {
  const uriFactory = new UriFactory(new RepositoryRegistry());
  const repo: RepoContext = {
    kind: 'git',
    repoRoot: 'c:/repo',
    repoId: 'repo123'
  };

  return {
    id: 'session-diff',
    uri: uriFactory.createSessionUri('session-diff', 'src/sample.ts'),
    repo,
    originalUri: vscode.Uri.file('c:/repo/src/sample.ts'),
    relativePath: 'src/sample.ts',
    revisions: [
      { id: 'A', shortLabel: 'A' },
      { id: 'B', shortLabel: 'B' },
      { id: 'C', shortLabel: 'C' }
    ],
    createdAt: Date.now(),
    rowCount: alignment.rowCount,
    rawSnapshots: alignment.rawSnapshots,
    globalRows: alignment.globalRows,
    adjacentPairs: alignment.adjacentPairs,
    activeRevisionIndex: 1,
    activePairKey: '1:2',
    pageStart: 0
  };
}
