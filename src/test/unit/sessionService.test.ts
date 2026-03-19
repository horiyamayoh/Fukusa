import * as assert from 'assert';
import * as vscode from 'vscode';

import { NWayCompareSession, RepoContext, RevisionRef } from '../../adapters/common/types';
import { RepositoryRegistry } from '../../application/repositoryRegistry';
import { MAX_VISIBLE_REVISIONS, SessionService } from '../../application/sessionService';
import { UriFactory } from '../../infrastructure/fs/uriFactory';

suite('Unit: SessionService', () => {
  const repo: RepoContext = {
    kind: 'git',
    repoRoot: 'c:/repo',
    repoId: 'repo123'
  };

  test('derives the active pair from the focused revision inside the visible window', () => {
    const service = new SessionService();
    const session = service.createBrowserSession(createSession('session-1', createRevisions(4)));

    service.setActiveRevision(session.id, 2);

    assert.strictEqual(service.getActivePair(session)?.key, '2:3');
  });

  test('falls back to the left pair when the focused revision is the last visible column', () => {
    const service = new SessionService();
    const session = service.createBrowserSession(createSession('session-2', createRevisions(4)));

    service.setActiveRevision(session.id, 3);

    assert.strictEqual(service.getActivePair(session)?.key, '2:3');
  });

  test('derives the active pair from the visible base column in base mode', () => {
    const service = new SessionService();
    const session = service.createBrowserSession(createSession('session-base', createRevisions(4), 'base'));

    service.setActiveRevision(session.id, 2);

    assert.strictEqual(service.getActivePair(session)?.key, '0:2');
  });

  test('derives the active pair from the nearest visible pair in all mode', () => {
    const service = new SessionService();
    const session = service.createBrowserSession(createSession('session-all', createRevisions(4), 'all'));

    service.setActiveRevision(session.id, 1);

    assert.strictEqual(service.getActivePair(session)?.key, '1:2');
  });

  test('updates active revision from a raw snapshot uri binding', () => {
    const service = new SessionService();
    const session = service.createBrowserSession(createSession('session-3', createRevisions(4)));

    service.updateFocusFromUri(session.rawSnapshots[2].rawUri);

    assert.strictEqual(service.getActiveSnapshot(session)?.revisionIndex, 2);
  });

  test('keeps revision selection in bounds', () => {
    const service = new SessionService();
    const session = service.createBrowserSession(createSession('session-4', createRevisions(4)));

    service.setActiveRevision(session.id, 99);

    assert.strictEqual(service.getActiveSnapshot(session)?.revisionIndex, 3);
    assert.strictEqual(service.getActivePair(session)?.key, '2:3');
  });

  test('shifts the visible window and clamps the active revision into the new page', () => {
    const service = new SessionService();
    const session = service.createBrowserSession(createSession('session-5', createRevisions(11)));

    service.setActiveRevision(session.id, 8);
    const shifted = service.shiftWindow(session.id, 1, MAX_VISIBLE_REVISIONS);
    const shiftedViewState = service.getSessionViewState(session.id);

    assert.ok(shifted);
    assert.strictEqual(shiftedViewState.pageStart, 1);
    assert.strictEqual(service.getVisibleWindow(session).startRevisionIndex, 1);
    assert.strictEqual(shiftedViewState.activeRevisionIndex, 8);

    service.shiftWindow(session.id, 2, MAX_VISIBLE_REVISIONS);
    const shiftedAgainViewState = service.getSessionViewState(session.id);
    assert.strictEqual(shiftedAgainViewState.pageStart, 2);
    assert.strictEqual(shiftedAgainViewState.activeRevisionIndex, 8);
  });

  test('evicts the oldest session when the limit is reached', () => {
    const service = new SessionService(2);
    const first = service.createBrowserSession(createSession('session-a', createRevisions(2)));
    const second = service.createBrowserSession(createSession('session-b', createRevisions(2)));
    const third = service.createBrowserSession(createSession('session-c', createRevisions(2)));

    assert.strictEqual(service.getSession(first.id), undefined);
    assert.ok(service.getSession(second.id));
    assert.ok(service.getSession(third.id));
    assert.strictEqual(service.listSessions().length, 2);
  });

  test('replaces compare document bindings for the active visible window', () => {
    const service = new SessionService();
    const session = service.createBrowserSession(createSession('session-bindings', createRevisions(3)));
    const uriFactory = new UriFactory(new RepositoryRegistry());
    const firstWindowUri = uriFactory.createSessionDocumentUri(session.id, 0, 1, 'src/sample.ts', 'r1');
    const secondWindowUri = uriFactory.createSessionDocumentUri(session.id, 1, 2, 'src/sample.ts', 'r2');

    service.replaceVisibleWindowBindings(session.id, [
      {
        sessionId: session.id,
        revisionIndex: 1,
        revisionId: 'rev-1',
        relativePath: 'src/sample.ts',
        rawUri: session.rawSnapshots[1].rawUri,
        documentUri: firstWindowUri,
        lineNumberSpace: 'globalRow',
        windowStart: 0
      }
    ]);
    service.replaceVisibleWindowBindings(session.id, [
      {
        sessionId: session.id,
        revisionIndex: 2,
        revisionId: 'rev-2',
        relativePath: 'src/sample.ts',
        rawUri: session.rawSnapshots[2].rawUri,
        documentUri: secondWindowUri,
        lineNumberSpace: 'globalRow',
        windowStart: 1
      }
    ]);

    assert.strictEqual(service.getSessionFileBinding(firstWindowUri), undefined);
    assert.strictEqual(service.getSessionFileBinding(secondWindowUri)?.revisionIndex, 2);
    assert.strictEqual(service.getSessionFileBinding(secondWindowUri)?.lineNumberSpace, 'globalRow');
  });

  test('tracks shared row projection state per session', () => {
    const service = new SessionService();
    const session = service.createBrowserSession(createSession('session-projection', createRevisions(3), 'adjacent', {
      rowCount: 20,
      changedRowNumbers: [10]
    }));

    assert.deepStrictEqual(service.getRowProjectionState(session.id), {
      collapseUnchanged: false,
      expandedGapKeys: []
    });

    service.toggleCollapseUnchanged(session.id);
    service.expandProjectionGap(session.id, '14:20');

    assert.deepStrictEqual(service.getRowProjectionState(session.id), {
      collapseUnchanged: true,
      expandedGapKeys: ['14:20']
    });

    service.toggleCollapseUnchanged(session.id);

    assert.deepStrictEqual(service.getRowProjectionState(session.id), {
      collapseUnchanged: false,
      expandedGapKeys: []
    });
  });

  test('separates session list changes from view state changes', () => {
    const service = new SessionService();
    const session = service.createBrowserSession(createSession('session-events', createRevisions(11), 'all'));
    let sessionChangeCount = 0;
    const viewStateChanges: string[] = [];
    service.onDidChangeSessions(() => {
      sessionChangeCount += 1;
    });
    service.onDidChangeSessionViewState((sessionId) => {
      viewStateChanges.push(sessionId);
    });

    service.setActiveRevision(session.id, 3);
    service.setActivePair(session.id, '0:2');
    service.shiftWindow(session.id, 1, MAX_VISIBLE_REVISIONS);

    assert.strictEqual(sessionChangeCount, 0);
    assert.deepStrictEqual(viewStateChanges, [session.id, session.id, session.id]);
  });

  test('ignores invalid or duplicate expanded gap requests', () => {
    const service = new SessionService();
    const session = service.createBrowserSession(createSession('session-gap-validation', createRevisions(3), 'adjacent', {
      rowCount: 20,
      changedRowNumbers: [10]
    }));
    let projectionChangeCount = 0;
    service.onDidChangeSessionProjection(() => {
      projectionChangeCount += 1;
    });

    service.toggleCollapseUnchanged(session.id);
    projectionChangeCount = 0;

    service.expandProjectionGap(session.id, '1:2');
    assert.deepStrictEqual(service.getRowProjectionState(session.id), {
      collapseUnchanged: true,
      expandedGapKeys: []
    });
    assert.strictEqual(projectionChangeCount, 0);

    service.expandProjectionGap(session.id, '14:20');
    assert.deepStrictEqual(service.getRowProjectionState(session.id), {
      collapseUnchanged: true,
      expandedGapKeys: ['14:20']
    });
    assert.strictEqual(projectionChangeCount, 1);

    service.expandProjectionGap(session.id, '14:20');
    assert.deepStrictEqual(service.getRowProjectionState(session.id), {
      collapseUnchanged: true,
      expandedGapKeys: ['14:20']
    });
    assert.strictEqual(projectionChangeCount, 1);
  });

  test('can expand all collapsed gaps and then reset the expanded set', () => {
    const service = new SessionService();
    const session = service.createBrowserSession(createSession('session-gap-bulk-actions', createRevisions(3), 'adjacent', {
      rowCount: 20,
      changedRowNumbers: [10]
    }));
    let projectionChangeCount = 0;
    service.onDidChangeSessionProjection(() => {
      projectionChangeCount += 1;
    });

    service.toggleCollapseUnchanged(session.id);
    projectionChangeCount = 0;

    service.expandAllProjectionGaps(session.id);

    assert.deepStrictEqual(service.getRowProjectionState(session.id), {
      collapseUnchanged: true,
      expandedGapKeys: ['1:6', '14:20']
    });
    assert.strictEqual(projectionChangeCount, 1);

    service.resetExpandedProjectionGaps(session.id);

    assert.deepStrictEqual(service.getRowProjectionState(session.id), {
      collapseUnchanged: true,
      expandedGapKeys: []
    });
    assert.strictEqual(projectionChangeCount, 2);
  });

  test('updates pair projection with normalization and suppresses duplicate projection events', () => {
    const service = new SessionService();
    const session = service.createBrowserSession(createSession('session-pair-projection', createRevisions(4), 'adjacent', {
      rowCount: 20,
      changedRowNumbers: [10]
    }));
    let projectionChangeCount = 0;
    service.onDidChangeSessionProjection(() => {
      projectionChangeCount += 1;
    });
    service.toggleCollapseUnchanged(session.id);
    service.expandProjectionGap(session.id, '14:20');
    projectionChangeCount = 0;

    service.updatePairProjection(session.id, {
      mode: 'custom',
      pairKeys: ['0:2', '0:2', '9:10']
    });

    assert.deepStrictEqual(service.getSession(session.id)?.pairProjection, {
      mode: 'custom',
      pairKeys: ['0:2']
    });
    assert.deepStrictEqual(service.getRowProjectionState(session.id), {
      collapseUnchanged: true,
      expandedGapKeys: []
    });
    assert.strictEqual(projectionChangeCount, 1);

    service.updatePairProjection(session.id, {
      mode: 'custom',
      pairKeys: ['0:2']
    });

    assert.strictEqual(projectionChangeCount, 1);
  });

  test('clears expanded gap state when the native window shifts to a different page', () => {
    const service = new SessionService();
    const session = service.createBrowserSession(createSession('session-shift-clears-gaps', createRevisions(11), 'adjacent', {
      rowCount: 20,
      changedRowNumbers: [10]
    }));

    service.toggleCollapseUnchanged(session.id);
    service.expandProjectionGap(session.id, '14:20');
    service.shiftWindow(session.id, 1, MAX_VISIBLE_REVISIONS);

    assert.deepStrictEqual(service.getRowProjectionState(session.id), {
      collapseUnchanged: true,
      expandedGapKeys: []
    });
  });

  test('updates surface mode and emits presentation changes only when the surface actually changes', () => {
    const service = new SessionService();
    const session = service.createBrowserSession(createSession('session-surface-mode', createRevisions(3)));
    let presentationChangeCount = 0;
    service.onDidChangeSessionPresentation(() => {
      presentationChangeCount += 1;
    });

    service.updateSurfaceMode(session.id, 'panel');

    assert.strictEqual(service.getSession(session.id)?.surfaceMode, 'panel');
    assert.strictEqual(presentationChangeCount, 1);

    service.updateSurfaceMode(session.id, 'panel');

    assert.strictEqual(presentationChangeCount, 1);
  });

  function createSession(
    sessionId: string,
    revisions: readonly RevisionRef[],
    pairProjectionMode: 'adjacent' | 'base' | 'all' | 'custom' = 'adjacent',
    options: {
      readonly rowCount?: number;
      readonly changedRowNumbers?: readonly number[];
    } = {}
  ): NWayCompareSession {
    const uriFactory = new UriFactory(new RepositoryRegistry());
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
      pairProjection: pairProjectionMode === 'custom'
        ? { mode: 'custom', pairKeys: ['0:2', '1:3'] }
        : { mode: pairProjectionMode },
      surfaceMode: 'native'
    };
  }

  function createRevisions(count: number): RevisionRef[] {
    return Array.from({ length: count }, (_, index) => ({
      id: `rev-${index}`,
      shortLabel: `r${index}`
    }));
  }
});
