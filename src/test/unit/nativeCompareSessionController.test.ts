import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';

import { NWayCompareSession, RepoContext, RevisionRef } from '../../adapters/common/types';
import { RepositoryRegistry } from '../../application/repositoryRegistry';
import { SessionService } from '../../application/sessionService';
import { UriFactory } from '../../infrastructure/fs/uriFactory';
import { OutputLogger } from '../../util/output';
import { DiffDecorationController } from '../../presentation/native/diffDecorationController';
import { EditorLayoutController } from '../../presentation/native/editorLayoutController';
import { EditorSyncController } from '../../presentation/native/editorSyncController';
import { NativeCompareSessionController } from '../../presentation/native/nativeCompareSessionController';

suite('Unit: NativeCompareSessionController', () => {
  teardown(() => {
    sinon.restore();
  });

  test('renders native editors and shifts overflow windows by one revision', async () => {
    const textDocument = {
      uri: vscode.Uri.file('c:/repo/.fukusa-shadow/revisions/stub/src/sample.ts'),
      lineCount: 1
    } as vscode.TextDocument;
    const openTextDocumentStub = sinon.stub(vscode.workspace, 'openTextDocument').resolves(textDocument);
    const showTextDocumentStub = sinon.stub(vscode.window, 'showTextDocument').resolves({
      document: textDocument,
      setDecorations: () => undefined,
      revealRange: () => undefined
    } as unknown as vscode.TextEditor);
    const layoutController = new TestLayoutController();
    const sessionService = new SessionService();
    const diffDecorationController = { refresh: sinon.stub(), dispose: sinon.stub() } as unknown as DiffDecorationController;
    const editorSyncController = {
      setSession: sinon.stub(),
      clear: sinon.stub(),
      dispose: sinon.stub()
    } as unknown as EditorSyncController;
    const controller = new NativeCompareSessionController(
      sessionService,
      layoutController,
      diffDecorationController,
      editorSyncController,
      new OutputLogger('NativeCompareSessionController Test')
    );
    const session = sessionService.createBrowserSession(createSession('session-1', createRevisions(10)));

    await controller.openSession(session);
    await controller.shiftWindow(1);

    assert.deepStrictEqual(layoutController.calls, [9, 9]);
    assert.strictEqual(openTextDocumentStub.callCount, 18);
    assert.strictEqual(showTextDocumentStub.callCount, 18);
    assert.strictEqual(session.pageStart, 1);
    assert.strictEqual((editorSyncController.setSession as sinon.SinonStub).callCount >= 2, true);
    assert.strictEqual((diffDecorationController.refresh as sinon.SinonStub).callCount >= 2, true);

    controller.dispose();
  });
});

class TestLayoutController extends EditorLayoutController {
  public readonly calls: number[] = [];

  public override async setLayout(columns: number): Promise<void> {
    this.calls.push(columns);
  }
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
