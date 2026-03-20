import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';

import { NWayCompareSession, RepoContext, RevisionRef } from '../../adapters/common/types';
import { RepositoryRegistry } from '../../application/repositoryRegistry';
import { SessionService } from '../../application/sessionService';
import { CommandContext } from '../../commands/commandContext';
import { createOpenActiveSessionSnapshotCommand } from '../../commands/openActiveSessionSnapshot';
import { UriFactory } from '../../infrastructure/fs/uriFactory';

suite('Unit: openActiveSessionSnapshot', () => {
  teardown(() => {
    sinon.restore();
  });

  test('opens the active snapshot for an explicitly targeted session and marks it active', async () => {
    const sessionService = new SessionService();
    const firstSession = sessionService.createBrowserSession(createSession('snapshot-first', createRevisions(3)));
    const secondSession = sessionService.createBrowserSession(createSession('snapshot-second', createRevisions(3)));
    sessionService.setActiveRevision(firstSession.id, 2);
    const resolveSnapshotUriStub = sinon.stub().resolves(firstSession.rawSnapshots[2].snapshotUri);
    const openTextDocumentStub = sinon.stub(vscode.workspace, 'openTextDocument').resolves({
      uri: firstSession.rawSnapshots[2].snapshotUri
    } as vscode.TextDocument);
    const showTextDocumentStub = sinon.stub(vscode.window, 'showTextDocument').resolves({} as vscode.TextEditor);

    await createOpenActiveSessionSnapshotCommand(createContext(sessionService, resolveSnapshotUriStub))(firstSession.id);

    assert.strictEqual(sessionService.getActiveBrowserSession()?.id, firstSession.id);
    assert.strictEqual(sessionService.getSessionViewState(firstSession.id).activeRevisionIndex, 2);
    assert.strictEqual(sessionService.getActiveBrowserSession()?.id, firstSession.id);
    assert.strictEqual(resolveSnapshotUriStub.firstCall.args[0]?.toString(), firstSession.rawSnapshots[2].snapshotUri.toString());
    assert.strictEqual(openTextDocumentStub.firstCall.args[0]?.toString(), firstSession.rawSnapshots[2].snapshotUri.toString());
    assert.strictEqual(showTextDocumentStub.callCount, 1);
    assert.strictEqual(sessionService.getSessionViewState(secondSession.id).activeRevisionIndex, 0);
  });

  test('opens a specifically targeted snapshot revision from the session tree target', async () => {
    const sessionService = new SessionService();
    const session = sessionService.createBrowserSession(createSession('snapshot-target', createRevisions(4)));
    const tempSnapshotUri = vscode.Uri.file('c:/temp/rev-1-snapshot.ts');
    const resolveSnapshotUriStub = sinon.stub().resolves(tempSnapshotUri);
    const openTextDocumentStub = sinon.stub(vscode.workspace, 'openTextDocument').resolves({
      uri: tempSnapshotUri
    } as vscode.TextDocument);
    sinon.stub(vscode.window, 'showTextDocument').resolves({} as vscode.TextEditor);

    await createOpenActiveSessionSnapshotCommand(createContext(sessionService, resolveSnapshotUriStub))({
      sessionId: session.id,
      revisionIndex: 1
    });

    assert.strictEqual(sessionService.getActiveBrowserSession()?.id, session.id);
    assert.strictEqual(sessionService.getSessionViewState(session.id).activeRevisionIndex, 1);
    assert.strictEqual(resolveSnapshotUriStub.firstCall.args[0]?.toString(), session.rawSnapshots[1].snapshotUri.toString());
    assert.strictEqual(openTextDocumentStub.firstCall.args[0]?.toString(), tempSnapshotUri.toString());
  });
});

function createContext(
  sessionService: SessionService,
  resolveSnapshotUri = sinon.stub().callsFake(async (uri: vscode.Uri) => uri)
): CommandContext {
  return {
    output: { info: sinon.stub() } as never,
    repositoryService: {} as never,
    revisionPickerService: {} as never,
    uriFactory: {} as never,
    compatibilityService: {
      resolveSnapshotUri
    } as never,
    sessionBuilderService: {} as never,
    sessionService,
    compareSessionController: {} as never,
    cacheService: {} as never,
    blameDecorationController: {} as never
  } as unknown as CommandContext;
}

function createSession(sessionId: string, revisions: readonly RevisionRef[]): NWayCompareSession {
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
    globalRows: [{
      rowNumber: 1,
      cells: revisions.map((revision, index) => ({
        revisionIndex: index,
        rowNumber: 1,
        present: true,
        text: revision.id,
        originalLineNumber: 1
      }))
    }],
    adjacentPairs: revisions.slice(0, -1).map((revision, index) => ({
      key: `${index}:${index + 1}`,
      leftRevisionIndex: index,
      rightRevisionIndex: index + 1,
      label: `${revision.shortLabel}-${revisions[index + 1].shortLabel}`,
      changedRowNumbers: [1]
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
