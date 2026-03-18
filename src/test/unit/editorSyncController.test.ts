import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';

import { NWayCompareSession, RepoContext, SessionFileBinding } from '../../adapters/common/types';
import { RepositoryRegistry } from '../../application/repositoryRegistry';
import { SessionService } from '../../application/sessionService';
import { UriFactory } from '../../infrastructure/fs/uriFactory';
import { EditorSyncController } from '../../presentation/native/editorSyncController';

suite('Unit: EditorSyncController', () => {
  teardown(() => {
    sinon.restore();
  });

  test('syncs peers from any visible compare editor and updates the active revision from that source', async () => {
    const clock = sinon.useFakeTimers({ shouldClearNativeTimers: true });
    const sessionService = new SessionService();
    const uriFactory = new UriFactory(new RepositoryRegistry());
    const session = sessionService.createBrowserSession(createSession('session-sync', 3));
    const visibleWindow = sessionService.getVisibleWindow(session);
    const bindings = createCompareBindings(session, uriFactory, visibleWindow.startRevisionIndex);
    sessionService.replaceVisibleWindowBindings(session.id, bindings);

    const leftEditor = createEditor(bindings[0].documentUri, 120, [new vscode.Range(0, 0, 10, 0)]);
    const sourceEditor = createEditor(bindings[1].documentUri, 120, [new vscode.Range(42, 0, 55, 0)]);
    const rightEditor = createEditor(bindings[2].documentUri, 120, [new vscode.Range(0, 0, 10, 0)]);
    stubWindowEditors(undefined, [leftEditor, sourceEditor, rightEditor]);

    const controller = new EditorSyncController(sessionService);
    controller.setSession(session, visibleWindow, 7);

    await invokeVisibleRangeChange(controller, sourceEditor);
    await clock.tickAsync(20);

    assert.strictEqual((leftEditor.revealRange as sinon.SinonSpy).callCount, 1);
    assert.strictEqual((rightEditor.revealRange as sinon.SinonSpy).callCount, 1);
    assert.strictEqual(((leftEditor.revealRange as sinon.SinonSpy).firstCall.args[0] as vscode.Range).start.line, 42);
    assert.strictEqual(((rightEditor.revealRange as sinon.SinonSpy).firstCall.args[0] as vscode.Range).start.line, 42);
    assert.strictEqual(sessionService.getActiveSnapshot(session)?.revisionIndex, 1);

    controller.dispose();
    clock.restore();
  });

  test('skips redundant reveals for the same synchronized top line', async () => {
    const clock = sinon.useFakeTimers({ shouldClearNativeTimers: true });
    const sessionService = new SessionService();
    const uriFactory = new UriFactory(new RepositoryRegistry());
    const session = sessionService.createBrowserSession(createSession('session-repeat', 2));
    const visibleWindow = sessionService.getVisibleWindow(session);
    const bindings = createCompareBindings(session, uriFactory, visibleWindow.startRevisionIndex);
    sessionService.replaceVisibleWindowBindings(session.id, bindings);

    const sourceEditor = createEditor(bindings[0].documentUri, 120, [new vscode.Range(20, 0, 30, 0)]);
    const targetEditor = createEditor(bindings[1].documentUri, 120, [new vscode.Range(0, 0, 10, 0)]);
    stubWindowEditors(undefined, [sourceEditor, targetEditor]);

    const controller = new EditorSyncController(sessionService);
    controller.setSession(session, visibleWindow, 3);

    await invokeVisibleRangeChange(controller, sourceEditor);
    await clock.tickAsync(20);
    (targetEditor as unknown as { visibleRanges: readonly vscode.Range[] }).visibleRanges = [new vscode.Range(20, 0, 30, 0)];

    await invokeVisibleRangeChange(controller, sourceEditor);
    await clock.tickAsync(20);

    assert.strictEqual((targetEditor.revealRange as sinon.SinonSpy).callCount, 1);

    controller.dispose();
    clock.restore();
  });
});

function createSession(sessionId: string, revisionCount: number): NWayCompareSession {
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
    revisions: Array.from({ length: revisionCount }, (_, index) => ({
      id: `rev-${index}`,
      shortLabel: `r${index}`
    })),
    createdAt: Date.now(),
    rowCount: 120,
    rawSnapshots: Array.from({ length: revisionCount }, (_, index) => ({
      snapshotUri: vscode.Uri.file(`c:/repo/.fukusa-shadow/revisions/rev-${index}/src/sample.ts`),
      rawUri: vscode.Uri.file(`c:/repo/.fukusa-shadow/revisions/rev-${index}/src/sample.ts`),
      revisionIndex: index,
      revisionId: `rev-${index}`,
      revisionLabel: `r${index}`,
      relativePath: 'src/sample.ts',
      lineMap: {
        rowToOriginalLine: new Map([[1, 1]]),
        originalLineToRow: new Map([[1, 1]])
      }
    })),
    globalRows: Array.from({ length: 120 }, (_, index) => ({
      rowNumber: index + 1,
      cells: Array.from({ length: revisionCount }, (_, revisionIndex) => ({
        revisionIndex,
        rowNumber: index + 1,
        present: true,
        text: `line-${index + 1}-rev-${revisionIndex}`,
        originalLineNumber: index + 1
      }))
    })),
    adjacentPairs: Array.from({ length: revisionCount - 1 }, (_, index) => ({
      key: `${index}:${index + 1}`,
      leftRevisionIndex: index,
      rightRevisionIndex: index + 1,
      label: `r${index}-r${index + 1}`,
      changedRowNumbers: []
    })),
    activeRevisionIndex: 0,
    activePairKey: revisionCount > 1 ? '0:1' : undefined,
    pageStart: 0
  };
}

function createCompareBindings(
  session: NWayCompareSession,
  uriFactory: UriFactory,
  windowStart: number
): SessionFileBinding[] {
  return session.rawSnapshots.map((snapshot) => ({
    sessionId: session.id,
    revisionIndex: snapshot.revisionIndex,
    revisionId: snapshot.revisionId,
    relativePath: snapshot.relativePath,
    rawUri: snapshot.rawUri,
    documentUri: uriFactory.createSessionDocumentUri(
      session.id,
      windowStart,
      snapshot.revisionIndex,
      snapshot.relativePath,
      snapshot.revisionLabel
    ),
    lineNumberSpace: 'globalRow',
    windowStart
  }));
}

function createEditor(uri: vscode.Uri, lineCount: number, initialVisibleRanges: readonly vscode.Range[]): vscode.TextEditor {
  const editor = {
    document: {
      uri,
      lineCount
    } as vscode.TextDocument,
    visibleRanges: [...initialVisibleRanges],
    revealRange: sinon.spy(),
    setDecorations: () => undefined
  } as unknown as vscode.TextEditor & { visibleRanges: readonly vscode.Range[] };

  return editor;
}

function stubWindowEditors(activeEditor: vscode.TextEditor | undefined, visibleEditors: readonly vscode.TextEditor[]): void {
  (sinon as unknown as {
    replaceGetter(object: object, property: string, getter: () => unknown): void;
  }).replaceGetter(vscode.window, 'activeTextEditor', () => activeEditor);
  (sinon as unknown as {
    replaceGetter(object: object, property: string, getter: () => unknown): void;
  }).replaceGetter(vscode.window, 'visibleTextEditors', () => visibleEditors);
}

async function invokeVisibleRangeChange(controller: EditorSyncController, editor: vscode.TextEditor): Promise<void> {
  await (controller as unknown as {
    handleVisibleRangeChange(event: vscode.TextEditorVisibleRangesChangeEvent): Promise<void>;
  }).handleVisibleRangeChange({
    textEditor: editor,
    visibleRanges: editor.visibleRanges
  } as vscode.TextEditorVisibleRangesChangeEvent);
}
