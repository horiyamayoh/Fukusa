import * as assert from 'assert';
import * as vscode from 'vscode';

import { NWayCompareSession, RepoContext, RevisionRef, SessionViewState } from '../../adapters/common/types';
import { RepositoryRegistry } from '../../application/repositoryRegistry';
import { buildSessionViewport, getSessionVisibleWindow, MAX_VISIBLE_REVISIONS } from '../../application/sessionViewport';
import { UriFactory } from '../../infrastructure/fs/uriFactory';

suite('Unit: sessionViewport', () => {
  test('builds one native viewport model from window paging and active-pair semantics', () => {
    const session = createSession('viewport-native', createRevisions(11), {
      surfaceMode: 'native',
      rowCount: 4,
      changedRowNumbers: [2]
    });
    const viewState = createViewState({ pageStart: 2, activeRevisionIndex: 3, activePairKey: '3:4' });

    const viewport = buildSessionViewport(session, viewState, { collapseUnchanged: false }, MAX_VISIBLE_REVISIONS);

    assert.strictEqual(viewport.visibleWindow.startRevisionIndex, 2);
    assert.strictEqual(viewport.visibleWindow.endRevisionIndex, 10);
    assert.strictEqual(viewport.visibleWindow.rawSnapshots.length, 9);
    assert.strictEqual(viewport.activePair?.key, '3:4');
    assert.deepStrictEqual(viewport.visiblePairs.map((pair) => pair.key), ['2:3', '3:4', '4:5', '5:6', '6:7', '7:8', '8:9', '9:10']);
  });

  test('keeps a line-based fallback when collapse projection yields only gaps', () => {
    const session = createSession('viewport-gaps', createRevisions(2), {
      surfaceMode: 'native',
      rowCount: 6,
      changedRowNumbers: []
    });
    const viewState = createViewState();

    const viewport = buildSessionViewport(session, viewState, { collapseUnchanged: true });

    assert.deepStrictEqual(viewport.rowProjection.rows.map((row) => row.kind), ['gap']);
    assert.deepStrictEqual(viewport.visibleDataRowNumbers, []);
    assert.deepStrictEqual(viewport.documentGlobalRowNumbers, [1, 2, 3, 4, 5, 6]);
    assert.strictEqual(viewport.documentLineMap.documentLineToGlobalRow.get(1), 1);
    assert.strictEqual(viewport.documentLineMap.documentLineToGlobalRow.get(6), 6);
  });

  test('treats panel sessions as one full visible window regardless of pageStart', () => {
    const session = createSession('viewport-panel', createRevisions(4), {
      surfaceMode: 'panel'
    });
    const viewState = createViewState({ pageStart: 3 });

    const visibleWindow = getSessionVisibleWindow(session, viewState);

    assert.strictEqual(visibleWindow.startRevisionIndex, 0);
    assert.strictEqual(visibleWindow.endRevisionIndex, 3);
    assert.strictEqual(visibleWindow.rawSnapshots.length, 4);
  });
});

function createSession(
  sessionId: string,
  revisions: readonly RevisionRef[],
  options: {
    readonly surfaceMode?: 'native' | 'panel';
    readonly rowCount?: number;
    readonly changedRowNumbers?: readonly number[];
  } = {}
): NWayCompareSession {
  const uriFactory = new UriFactory(new RepositoryRegistry());
  const repo: RepoContext = {
    kind: 'git',
    repoRoot: 'c:/repo',
    repoId: 'repo123'
  };
  const rowCount = options.rowCount ?? 1;
  const changedRowNumbers = options.changedRowNumbers ?? [1];

  return {
    id: sessionId,
    uri: uriFactory.createSessionUri(sessionId, 'src/sample.ts'),
    repo,
    originalUri: vscode.Uri.file('c:/repo/src/sample.ts'),
    relativePath: 'src/sample.ts',
    revisions,
    createdAt: Date.now(),
    rowCount,
    rawSnapshots: revisions.map((revision, index) => ({
      snapshotUri: vscode.Uri.file(`c:/repo/.fukusa-shadow/revisions/${revision.id}/src/sample.ts`),
      rawUri: vscode.Uri.file(`c:/repo/.fukusa-shadow/revisions/${revision.id}/src/sample.ts`),
      revisionIndex: index,
      revisionId: revision.id,
      revisionLabel: revision.shortLabel,
      relativePath: 'src/sample.ts',
      lineMap: {
        rowToOriginalLine: new Map([[1, 1]]),
        originalLineToRow: new Map([[1, 1]])
      }
    })),
    globalRows: Array.from({ length: rowCount }, (_, rowIndex) => ({
      rowNumber: rowIndex + 1,
      cells: revisions.map((revision, index) => ({
        revisionIndex: index,
        rowNumber: rowIndex + 1,
        present: true,
        text: `${revision.id}-${rowIndex + 1}`,
        originalLineNumber: rowIndex + 1
      }))
    })),
    adjacentPairs: revisions.slice(0, -1).map((revision, index) => ({
      key: `${index}:${index + 1}`,
      leftRevisionIndex: index,
      rightRevisionIndex: index + 1,
      label: `${revision.shortLabel}-${revisions[index + 1].shortLabel}`,
      changedRowNumbers
    })),
    pairProjection: { mode: 'adjacent' },
    surfaceMode: options.surfaceMode ?? 'native'
  };
}

function createViewState(overrides: Partial<SessionViewState> = {}): SessionViewState {
  return {
    activeRevisionIndex: 0,
    activePairKey: '0:1',
    pageStart: 0,
    ...overrides
  };
}

function createRevisions(count: number): RevisionRef[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `rev-${index}`,
    shortLabel: `r${index}`
  }));
}
