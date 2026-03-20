import * as assert from 'assert';
import * as vscode from 'vscode';

import { NWayCompareSession, RepoContext, RevisionRef } from '../../adapters/common/types';
import { RepositoryRegistry } from '../../application/repositoryRegistry';
import { SessionService } from '../../application/sessionService';
import { UriFactory } from '../../infrastructure/fs/uriFactory';
import { SessionsTreeProvider } from '../../presentation/views/sessionsTreeProvider';

suite('Unit: SessionsTreeProvider', () => {
  test('assigns session capability tokens and snapshot context values for tree menus', () => {
    const sessionService = new SessionService();
    const session = sessionService.createBrowserSession(createSession('tree-session', createRevisions(11), {
      rowCount: 20,
      changedRowNumbers: [10]
    }));
    const provider = new SessionsTreeProvider(sessionService);
    const roots = provider.getChildren();
    const sessionTreeElement = roots[0]!;
    const snapshotTreeElement = provider.getChildren(sessionTreeElement)[0]!;

    let sessionTreeItem = provider.getTreeItem(sessionTreeElement);
    const snapshotTreeItem = provider.getTreeItem(snapshotTreeElement);

    assert.match(String(sessionTreeItem.contextValue), /session/);
    assert.match(String(sessionTreeItem.contextValue), /has-active-snapshot/);
    assert.match(String(sessionTreeItem.contextValue), /has-active-pair/);
    assert.match(String(sessionTreeItem.contextValue), /pair-projectable/);
    assert.match(String(sessionTreeItem.contextValue), /window-shiftable/);
    assert.doesNotMatch(String(sessionTreeItem.contextValue), /can-shift-window-left/);
    assert.match(String(sessionTreeItem.contextValue), /can-shift-window-right/);
    assert.match(String(sessionTreeItem.description), /window 1-9\/11/);
    assert.match(String(sessionTreeItem.description), /active r0/);
    assert.match(String(sessionTreeItem.description), /pair r0-r1/);
    assert.strictEqual(snapshotTreeItem.contextValue, 'snapshot');
    assert.strictEqual(snapshotTreeItem.command?.command, 'multidiff.internal.openSessionSnapshot');
    assert.deepStrictEqual(snapshotTreeItem.command?.arguments, [{
      sessionId: session.id,
      revisionIndex: 0
    }]);
    assert.match(String(snapshotTreeItem.description), /active/);

    sessionService.shiftWindow(session.id, 1);
    sessionTreeItem = provider.getTreeItem(sessionTreeElement);
    assert.match(String(sessionTreeItem.contextValue), /can-shift-window-left/);
    assert.match(String(sessionTreeItem.contextValue), /can-shift-window-right/);
    assert.match(String(sessionTreeItem.description), /window 2-10\/11/);

    sessionService.toggleCollapseUnchanged(session.id);
    sessionTreeItem = provider.getTreeItem(sessionTreeElement);
    assert.match(String(sessionTreeItem.contextValue), /collapse-active/);
    assert.match(String(sessionTreeItem.contextValue), /has-collapsed-gaps/);

    sessionService.expandProjectionGap(session.id, '14:20');
    sessionTreeItem = provider.getTreeItem(sessionTreeElement);
    assert.match(String(sessionTreeItem.contextValue), /has-expanded-gaps/);

    sessionService.shiftWindow(session.id, 1);
    sessionTreeItem = provider.getTreeItem(sessionTreeElement);
    assert.match(String(sessionTreeItem.contextValue), /can-shift-window-left/);
    assert.doesNotMatch(String(sessionTreeItem.contextValue), /can-shift-window-right/);
    assert.match(String(sessionTreeItem.description), /window 3-11\/11/);
  });

  test('omits pair-diff capability tokens for single-revision sessions', () => {
    const sessionService = new SessionService();
    sessionService.createBrowserSession(createSession('tree-single-session', createRevisions(1)));
    const provider = new SessionsTreeProvider(sessionService);
    const sessionTreeItem = provider.getTreeItem(provider.getChildren()[0]!);

    assert.match(String(sessionTreeItem.contextValue), /has-active-snapshot/);
    assert.doesNotMatch(String(sessionTreeItem.contextValue), /has-active-pair/);
    assert.match(String(sessionTreeItem.description), /active r0/);
    assert.doesNotMatch(String(sessionTreeItem.description), /pair /);
  });

  test('resolves the latest session model when tree items are reused after session replacement', () => {
    const sessionService = new SessionService();
    const session = sessionService.createBrowserSession(createSession('tree-session-replaced', createRevisions(4), {
      rowCount: 20,
      changedRowNumbers: [10]
    }));
    const provider = new SessionsTreeProvider(sessionService);
    const sessionTreeElement = provider.getChildren()[0]!;

    sessionService.updatePairProjection(session.id, { mode: 'all' });
    sessionService.updateSurfaceMode(session.id, 'panel');

    const sessionTreeItem = provider.getTreeItem(sessionTreeElement);

    assert.match(String(sessionTreeItem.description), /panel/);
    assert.match(String(sessionTreeItem.description), /all/);
  });
});

function createSession(
  sessionId: string,
  revisions: readonly RevisionRef[],
  options: {
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
    surfaceMode: 'native'
  };
}

function createRevisions(count: number): RevisionRef[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `rev-${index}`,
    shortLabel: `r${index}`
  }));
}
