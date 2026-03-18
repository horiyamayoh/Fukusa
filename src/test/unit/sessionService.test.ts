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

    assert.ok(shifted);
    assert.strictEqual(session.pageStart, 1);
    assert.strictEqual(service.getVisibleWindow(session).startRevisionIndex, 1);
    assert.strictEqual(session.activeRevisionIndex, 8);

    service.shiftWindow(session.id, 2, MAX_VISIBLE_REVISIONS);
    assert.strictEqual(session.pageStart, 2);
    assert.strictEqual(session.activeRevisionIndex, 8);
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

  function createSession(sessionId: string, revisions: readonly RevisionRef[]): NWayCompareSession {
    const uriFactory = new UriFactory(new RepositoryRegistry());
    return {
      id: sessionId,
      uri: uriFactory.createSessionUri(sessionId, 'src/sample.ts'),
      repo,
      originalUri: vscode.Uri.file('c:/repo/src/sample.ts'),
      relativePath: 'src/sample.ts',
      revisions,
      createdAt: Date.now(),
      rowCount: 1,
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
      globalRows: [
        {
          rowNumber: 1,
          cells: revisions.map((revision, index) => ({
            revisionIndex: index,
            rowNumber: 1,
            present: true,
            text: revision.id,
            originalLineNumber: 1
          }))
        }
      ],
      adjacentPairs: revisions.slice(0, -1).map((revision, index) => ({
        key: `${index}:${index + 1}`,
        leftRevisionIndex: index,
        rightRevisionIndex: index + 1,
        label: `${revision.shortLabel}-${revisions[index + 1].shortLabel}`,
        changedRowNumbers: [1]
      })),
      activeRevisionIndex: 0,
      activePairKey: '0:1',
      pageStart: 0
    };
  }

  function createRevisions(count: number): RevisionRef[] {
    return Array.from({ length: count }, (_, index) => ({
      id: `rev-${index}`,
      shortLabel: `r${index}`
    }));
  }
});
