import * as assert from 'assert';
import * as vscode from 'vscode';

import { NWayCompareSession, RepoContext } from '../../adapters/common/types';
import { RepositoryRegistry } from '../../application/repositoryRegistry';
import { createProjectedLineMap } from '../../application/sessionRowProjection';
import { SessionAlignmentService } from '../../application/sessionAlignmentService';
import { UriFactory } from '../../infrastructure/fs/uriFactory';
import { buildRevisionDecorationModels, mapRevisionDecorationsToDocumentLines } from '../../presentation/native/diffDecorationController';

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

  test('supports base-oriented active pair highlighting for non-adjacent columns', () => {
    const alignment = new SessionAlignmentService().buildState([
      createSource(0, 'A', 'one\ntwo'),
      createSource(1, 'B', 'one\ntwo'),
      createSource(2, 'C', 'one\nTHREE')
    ]);

    const session = createSession(alignment, 'base');
    const models = buildRevisionDecorationModels(session, 0, 2, '0:2');

    assert.deepStrictEqual(models.get(0)?.nextPairEdges.map((entry) => entry.range.start.line), [1]);
    assert.strictEqual(models.get(1)?.modifiedLines.length ?? 0, 0);
    assert.deepStrictEqual(models.get(2)?.previousPairEdges.map((entry) => entry.range.start.line), [1]);
    assert.deepStrictEqual(models.get(0)?.modifiedLines.map((entry) => entry.range.start.line), [1]);
    assert.deepStrictEqual(models.get(2)?.modifiedLines.map((entry) => entry.range.start.line), [1]);
  });

  test('builds edge markers for every visible pair in all mode', () => {
    const alignment = new SessionAlignmentService().buildState([
      createSource(0, 'A', 'one\ntwo'),
      createSource(1, 'B', 'one\nTWO'),
      createSource(2, 'C', 'one\nTHREE')
    ]);

    const session = createSession(alignment, 'all');
    const models = buildRevisionDecorationModels(session, 0, 2, '1:2');

    assert.deepStrictEqual(models.get(0)?.nextPairEdges.map((entry) => entry.range.start.line), [1]);
    assert.deepStrictEqual(models.get(1)?.previousPairEdges.map((entry) => entry.range.start.line), [1]);
    assert.deepStrictEqual(models.get(1)?.nextPairEdges.map((entry) => entry.range.start.line), [1]);
    assert.deepStrictEqual(models.get(2)?.previousPairEdges.map((entry) => entry.range.start.line), [1]);
  });

  test('maps whole-line and intraline decorations through projected document rows', () => {
    const projectedLineMap = createProjectedLineMap([2, 4]);
    const mapped = mapRevisionDecorationsToDocumentLines({
      previousPairEdges: [newWholeLineDecoration(2), newWholeLineDecoration(3)],
      nextPairEdges: [],
      addedLines: [],
      removedLines: [],
      modifiedLines: [newWholeLineDecoration(4)],
      addedText: [{
        range: new vscode.Range(3, 1, 3, 3)
      }],
      removedText: []
    }, projectedLineMap);

    assert.deepStrictEqual(mapped.previousPairEdges.map((entry) => entry.range.start.line), [0]);
    assert.deepStrictEqual(mapped.modifiedLines.map((entry) => entry.range.start.line), [1]);
    assert.deepStrictEqual(mapped.addedText.map((entry) => [entry.range.start.line, entry.range.start.character, entry.range.end.character]), [[1, 1, 3]]);
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

function createSession(
  alignment: ReturnType<SessionAlignmentService['buildState']>,
  pairProjectionMode: 'adjacent' | 'base' | 'all' = 'adjacent'
): NWayCompareSession {
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
    pairProjection: { mode: pairProjectionMode },
    surfaceMode: 'native'
  };
}

function newWholeLineDecoration(lineNumber: number): vscode.DecorationOptions {
  return {
    range: new vscode.Range(lineNumber - 1, 0, lineNumber - 1, 0)
  };
}
