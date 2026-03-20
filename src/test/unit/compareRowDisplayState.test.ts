import * as assert from 'assert';
import * as vscode from 'vscode';

import { NWayCompareSession, RepoContext, SessionViewState } from '../../adapters/common/types';
import { buildCompareRowDisplayState } from '../../application/compareRowDisplayState';
import { RepositoryRegistry } from '../../application/repositoryRegistry';
import { SessionAlignmentService } from '../../application/sessionAlignmentService';
import { buildSessionViewport } from '../../application/sessionViewport';
import { UriFactory } from '../../infrastructure/fs/uriFactory';

suite('Unit: compareRowDisplayState', () => {
  test('builds edge and modified states for a non-adjacent active pair row', () => {
    const alignment = new SessionAlignmentService().buildState([
      createSource(0, 'A', 'one\ntwo'),
      createSource(1, 'B', 'one\ntwo'),
      createSource(2, 'C', 'one\nTHREE')
    ]);
    const session = createSession('row-display-base', alignment, 'base');
    const viewport = buildSessionViewport(session, createViewState(2, '0:2'));

    const rowState = buildCompareRowDisplayState(session, 2, viewport.visiblePairs, viewport.activePair);

    assert.strictEqual(rowState.isActivePairRow, true);
    assert.strictEqual(rowState.cells[0].hasNextPairEdge, true);
    assert.strictEqual(rowState.cells[1].hasPreviousPairEdge, false);
    assert.strictEqual(rowState.cells[2].hasPreviousPairEdge, true);
    assert.strictEqual(rowState.cells[0].activeChangeKind, 'modified');
    assert.strictEqual(rowState.cells[0].activeSegmentKind, 'removed');
    assert.strictEqual(rowState.cells[2].activeChangeKind, 'modified');
    assert.strictEqual(rowState.cells[2].activeSegmentKind, 'added');
  });

  test('marks removed active cells on placeholder rows', () => {
    const alignment = new SessionAlignmentService().buildState([
      createSource(0, 'A', 'top\nshared'),
      createSource(1, 'B', 'shared'),
      createSource(2, 'C', 'top\nshared')
    ]);
    const session = createSession('row-display-placeholder', alignment, 'adjacent');
    const viewport = buildSessionViewport(session, createViewState(0, '0:1'));

    const rowState = buildCompareRowDisplayState(session, 1, viewport.visiblePairs, viewport.activePair);

    assert.strictEqual(rowState.isActivePairRow, true);
    assert.strictEqual(rowState.cells[0].activeChangeKind, 'removed');
    assert.strictEqual(rowState.cells[0].activeSegmentKind, 'removed');
    assert.strictEqual(rowState.cells[1].activeChangeKind, 'none');
    assert.strictEqual(rowState.cells[1].hasPreviousPairEdge, true);
    assert.strictEqual(rowState.cells[1].hasNextPairEdge, true);
    assert.strictEqual(rowState.cells[2].hasPreviousPairEdge, true);
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
  sessionId: string,
  alignment: ReturnType<SessionAlignmentService['buildState']>,
  pairProjectionMode: 'adjacent' | 'base' | 'all'
): NWayCompareSession {
  const uriFactory = new UriFactory(new RepositoryRegistry());
  const repo: RepoContext = {
    kind: 'git',
    repoRoot: 'c:/repo',
    repoId: 'repo123'
  };

  return {
    id: sessionId,
    uri: uriFactory.createSessionUri(sessionId, 'src/sample.ts'),
    repo,
    originalUri: vscode.Uri.file('c:/repo/src/sample.ts'),
    relativePath: 'src/sample.ts',
    revisions: alignment.rawSnapshots.map((snapshot) => ({
      id: snapshot.revisionId,
      shortLabel: snapshot.revisionLabel
    })),
    createdAt: Date.now(),
    rowCount: alignment.rowCount,
    rawSnapshots: alignment.rawSnapshots,
    globalRows: alignment.globalRows,
    adjacentPairs: alignment.adjacentPairs,
    pairProjection: { mode: pairProjectionMode },
    surfaceMode: 'panel'
  };
}

function createViewState(activeRevisionIndex: number, activePairKey: string): SessionViewState {
  return {
    activeRevisionIndex,
    activePairKey,
    pageStart: 0
  };
}
