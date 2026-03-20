import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';

import { NWayCompareSession, RepoContext, SessionFileBinding } from '../../adapters/common/types';
import { RepositoryRegistry } from '../../application/repositoryRegistry';
import { createProjectedLineMap } from '../../application/sessionRowProjection';
import { SessionService } from '../../application/sessionService';
import { UriFactory } from '../../infrastructure/fs/uriFactory';
import { EditorSyncController } from '../../presentation/native/editorSyncController';

suite('Unit: EditorSyncController', () => {
  teardown(() => {
    sinon.restore();
  });

  test('syncs peers from any visible compare editor', async () => {
    const clock = sinon.useFakeTimers({ shouldClearNativeTimers: true });
    stubEditorConfigNoPadding();
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
    await clock.tickAsync(40);

    assert.strictEqual((leftEditor.revealRange as sinon.SinonSpy).callCount, 1);
    assert.strictEqual((rightEditor.revealRange as sinon.SinonSpy).callCount, 1);
    assert.strictEqual(((leftEditor.revealRange as sinon.SinonSpy).firstCall.args[0] as vscode.Range).start.line, 42);
    assert.strictEqual(((rightEditor.revealRange as sinon.SinonSpy).firstCall.args[0] as vscode.Range).start.line, 42);

    controller.dispose();
    clock.restore();
  });

  test('skips redundant reveals for the same synchronized top line', async () => {
    const clock = sinon.useFakeTimers({ shouldClearNativeTimers: true });
    stubEditorConfigNoPadding();
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
    await clock.tickAsync(40);
    (targetEditor as unknown as { visibleRanges: readonly vscode.Range[] }).visibleRanges = [new vscode.Range(20, 0, 30, 0)];

    await invokeVisibleRangeChange(controller, sourceEditor);
    await clock.tickAsync(40);

    assert.strictEqual((targetEditor.revealRange as sinon.SinonSpy).callCount, 1);

    controller.dispose();
    clock.restore();
  });

  test('maps projected document lines through global rows before syncing peers', async () => {
    const clock = sinon.useFakeTimers({ shouldClearNativeTimers: true });
    stubEditorConfigNoPadding();
    const sessionService = new SessionService();
    const uriFactory = new UriFactory(new RepositoryRegistry());
    const session = sessionService.createBrowserSession(createSession('session-projected-sync', 2));
    const visibleWindow = sessionService.getVisibleWindow(session);
    const projectedLineMap = createProjectedLineMap([10, 20, 30]);
    const bindings = createCompareBindings(session, uriFactory, visibleWindow.startRevisionIndex).map((binding) => ({
      ...binding,
      projectedGlobalRows: [10, 20, 30],
      projectedLineMap
    }));
    sessionService.replaceVisibleWindowBindings(session.id, bindings);

    const sourceEditor = createEditor(bindings[0].documentUri, 3, [new vscode.Range(1, 0, 2, 0)]);
    const targetEditor = createEditor(bindings[1].documentUri, 3, [new vscode.Range(0, 0, 1, 0)]);
    stubWindowEditors(undefined, [sourceEditor, targetEditor]);

    const controller = new EditorSyncController(sessionService);
    controller.setSession(session, visibleWindow, 5);

    await invokeVisibleRangeChange(controller, sourceEditor);
    await clock.tickAsync(40);

    assert.strictEqual((targetEditor.revealRange as sinon.SinonSpy).callCount, 1);
    assert.strictEqual(((targetEditor.revealRange as sinon.SinonSpy).firstCall.args[0] as vscode.Range).start.line, 1);

    controller.dispose();
    clock.restore();
  });

  test('scrolls the active editor natively and syncs peers immediately by one aligned row', async () => {
    const clock = sinon.useFakeTimers({ shouldClearNativeTimers: true });
    stubEditorConfigNoPadding();
    const sessionService = new SessionService();
    const uriFactory = new UriFactory(new RepositoryRegistry());
    const session = sessionService.createBrowserSession(createSession('session-aligned-scroll', 3));
    const visibleWindow = sessionService.getVisibleWindow(session);
    const bindings = createCompareBindings(session, uriFactory, visibleWindow.startRevisionIndex);
    sessionService.replaceVisibleWindowBindings(session.id, bindings);

    const leftEditor = createEditor(bindings[0].documentUri, 120, [new vscode.Range(0, 0, 10, 0)]);
    const middleEditor = createEditor(bindings[1].documentUri, 120, [new vscode.Range(0, 0, 10, 0)]);
    const rightEditor = createEditor(bindings[2].documentUri, 120, [new vscode.Range(0, 0, 10, 0)]);
    stubWindowEditors(leftEditor, [leftEditor, middleEditor, rightEditor]);
    const executeCommandStub = stubEditorScrollCommand(leftEditor);

    const controller = new EditorSyncController(sessionService);
    controller.setSession(session, visibleWindow, 9);

    const scrolled = await controller.scrollActiveEditorAligned(1);

    assert.strictEqual(scrolled, true);
    assert.strictEqual(executeCommandStub.callCount, 1);
    assert.deepStrictEqual(executeCommandStub.firstCall.args, ['editorScroll', {
      to: 'down',
      by: 'line',
      value: 1,
      revealCursor: false
    }]);
    assert.strictEqual((leftEditor.revealRange as sinon.SinonSpy).callCount, 0);
    assert.strictEqual((middleEditor.revealRange as sinon.SinonSpy).callCount, 1);
    assert.strictEqual((rightEditor.revealRange as sinon.SinonSpy).callCount, 1);
    assert.strictEqual(((middleEditor.revealRange as sinon.SinonSpy).firstCall.args[0] as vscode.Range).start.line, 1);
    assert.strictEqual(((rightEditor.revealRange as sinon.SinonSpy).firstCall.args[0] as vscode.Range).start.line, 1);
    assert.strictEqual(leftEditor.visibleRanges[0]?.start.line, 1);

    controller.dispose();
    clock.restore();
  });

  test('keeps native Ctrl+Arrow scroll in sync across repeated keyboard steps', async () => {
    const clock = sinon.useFakeTimers({ shouldClearNativeTimers: true });
    stubEditorConfigNoPadding();
    const sessionService = new SessionService();
    const uriFactory = new UriFactory(new RepositoryRegistry());
    const session = sessionService.createBrowserSession(createSession('session-aligned-repeat', 3));
    const visibleWindow = sessionService.getVisibleWindow(session);
    const bindings = createCompareBindings(session, uriFactory, visibleWindow.startRevisionIndex);
    sessionService.replaceVisibleWindowBindings(session.id, bindings);

    const leftEditor = createEditor(bindings[0].documentUri, 120, [new vscode.Range(0, 0, 10, 0)]);
    const middleEditor = createEditor(bindings[1].documentUri, 120, [new vscode.Range(0, 0, 10, 0)]);
    const rightEditor = createEditor(bindings[2].documentUri, 120, [new vscode.Range(0, 0, 10, 0)]);
    stubWindowEditors(leftEditor, [leftEditor, middleEditor, rightEditor]);
    const executeCommandStub = stubEditorScrollCommand(leftEditor);

    const controller = new EditorSyncController(sessionService);
    controller.setSession(session, visibleWindow, 10);

    assert.strictEqual(await controller.scrollActiveEditorAligned(1), true);
    assert.strictEqual(await controller.scrollActiveEditorAligned(1), true);

    assert.strictEqual(leftEditor.visibleRanges[0]?.start.line, 2);
    assert.strictEqual(middleEditor.visibleRanges[0]?.start.line, 2);
    assert.strictEqual(rightEditor.visibleRanges[0]?.start.line, 2);
    assert.strictEqual(executeCommandStub.callCount, 2);
    assert.strictEqual((leftEditor.revealRange as sinon.SinonSpy).callCount, 0);
    assert.strictEqual((middleEditor.revealRange as sinon.SinonSpy).callCount, 2);
    assert.strictEqual((rightEditor.revealRange as sinon.SinonSpy).callCount, 2);

    controller.dispose();
    clock.restore();
  });

  test('maps native keyboard scroll through projected global rows before syncing peers', async () => {
    const clock = sinon.useFakeTimers({ shouldClearNativeTimers: true });
    stubEditorConfigNoPadding();
    const sessionService = new SessionService();
    const uriFactory = new UriFactory(new RepositoryRegistry());
    const session = sessionService.createBrowserSession(createSession('session-aligned-projected', 2));
    const visibleWindow = sessionService.getVisibleWindow(session);
    const projectedLineMap = createProjectedLineMap([10, 20, 30]);
    const bindings = createCompareBindings(session, uriFactory, visibleWindow.startRevisionIndex).map((binding) => ({
      ...binding,
      projectedGlobalRows: [10, 20, 30],
      projectedLineMap
    }));
    sessionService.replaceVisibleWindowBindings(session.id, bindings);

    const sourceEditor = createEditor(bindings[0].documentUri, 3, [new vscode.Range(0, 0, 1, 0)]);
    const targetEditor = createEditor(bindings[1].documentUri, 3, [new vscode.Range(0, 0, 1, 0)]);
    stubWindowEditors(sourceEditor, [sourceEditor, targetEditor]);
    const executeCommandStub = stubEditorScrollCommand(sourceEditor);

    const controller = new EditorSyncController(sessionService);
    controller.setSession(session, visibleWindow, 11);

    const scrolled = await controller.scrollActiveEditorAligned(1);

    assert.strictEqual(scrolled, true);
    assert.strictEqual(executeCommandStub.callCount, 1);
    assert.strictEqual((sourceEditor.revealRange as sinon.SinonSpy).callCount, 0);
    assert.strictEqual((targetEditor.revealRange as sinon.SinonSpy).callCount, 1);
    assert.strictEqual(((targetEditor.revealRange as sinon.SinonSpy).firstCall.args[0] as vscode.Range).start.line, 1);
    assert.strictEqual(sourceEditor.visibleRanges[0]?.start.line, 1);

    controller.dispose();
    clock.restore();
  });

  test('ignores aligned keyboard scroll when the active editor is not a tracked Fukusa compare document', async () => {
    const clock = sinon.useFakeTimers({ shouldClearNativeTimers: true });
    stubEditorConfigNoPadding();
    const sessionService = new SessionService();
    const uriFactory = new UriFactory(new RepositoryRegistry());
    const session = sessionService.createBrowserSession(createSession('session-aligned-ignore', 2));
    const visibleWindow = sessionService.getVisibleWindow(session);
    const bindings = createCompareBindings(session, uriFactory, visibleWindow.startRevisionIndex);
    sessionService.replaceVisibleWindowBindings(session.id, bindings);

    const unrelatedEditor = createEditor(vscode.Uri.file('c:/repo/unrelated.ts'), 120, [new vscode.Range(0, 0, 10, 0)]);
    stubWindowEditors(unrelatedEditor, [unrelatedEditor]);
    const executeCommandStub = sinon.stub(vscode.commands, 'executeCommand').resolves(undefined);

    const controller = new EditorSyncController(sessionService);
    controller.setSession(session, visibleWindow, 12);

    const scrolled = await controller.scrollActiveEditorAligned(1);

    assert.strictEqual(scrolled, false);
    assert.strictEqual(executeCommandStub.callCount, 0);
    assert.strictEqual((unrelatedEditor.revealRange as sinon.SinonSpy).callCount, 0);

    controller.dispose();
    clock.restore();
  });

  test('restores the nearest projected document line when the requested global row is hidden', () => {
    stubEditorConfigNoPadding();
    const sessionService = new SessionService();
    const uriFactory = new UriFactory(new RepositoryRegistry());
    const session = sessionService.createBrowserSession(createSession('session-projected-restore', 2));
    const visibleWindow = sessionService.getVisibleWindow(session);
    const projectedLineMap = createProjectedLineMap([10, 20, 30]);
    const bindings = createCompareBindings(session, uriFactory, visibleWindow.startRevisionIndex).map((binding) => ({
      ...binding,
      projectedGlobalRows: [10, 20, 30],
      projectedLineMap
    }));
    sessionService.replaceVisibleWindowBindings(session.id, bindings);

    const leftEditor = createEditor(bindings[0].documentUri, 3, [new vscode.Range(0, 0, 1, 0)]);
    const rightEditor = createEditor(bindings[1].documentUri, 3, [new vscode.Range(0, 0, 1, 0)]);
    stubWindowEditors(leftEditor, [leftEditor, rightEditor]);

    const controller = new EditorSyncController(sessionService);
    controller.setSession(session, visibleWindow, 11);

    controller.restoreTopGlobalRow(session.id, 15, 11, visibleWindow.startRevisionIndex);
    controller.restoreTopGlobalRow(session.id, 35, 11, visibleWindow.startRevisionIndex);

    assert.strictEqual((leftEditor.revealRange as sinon.SinonSpy).callCount, 2);
    assert.strictEqual((rightEditor.revealRange as sinon.SinonSpy).callCount, 2);
    assert.strictEqual(((leftEditor.revealRange as sinon.SinonSpy).firstCall.args[0] as vscode.Range).start.line, 1);
    assert.strictEqual(((leftEditor.revealRange as sinon.SinonSpy).secondCall.args[0] as vscode.Range).start.line, 2);
    assert.strictEqual(((rightEditor.revealRange as sinon.SinonSpy).firstCall.args[0] as vscode.Range).start.line, 1);
    assert.strictEqual(((rightEditor.revealRange as sinon.SinonSpy).secondCall.args[0] as vscode.Range).start.line, 2);

    controller.dispose();
  });

  test('does not suppress source editor events after syncing peers', async () => {
    const clock = sinon.useFakeTimers({ shouldClearNativeTimers: true });
    stubEditorConfigNoPadding();
    const sessionService = new SessionService();
    const uriFactory = new UriFactory(new RepositoryRegistry());
    const session = sessionService.createBrowserSession(createSession('session-source-nosuppress', 3));
    const visibleWindow = sessionService.getVisibleWindow(session);
    const bindings = createCompareBindings(session, uriFactory, visibleWindow.startRevisionIndex);
    sessionService.replaceVisibleWindowBindings(session.id, bindings);

    const leftEditor = createEditor(bindings[0].documentUri, 120, [new vscode.Range(0, 0, 10, 0)]);
    const middleEditor = createEditor(bindings[1].documentUri, 120, [new vscode.Range(0, 0, 10, 0)]);
    const rightEditor = createEditor(bindings[2].documentUri, 120, [new vscode.Range(0, 0, 10, 0)]);
    stubWindowEditors(leftEditor, [leftEditor, middleEditor, rightEditor]);

    const controller = new EditorSyncController(sessionService);
    controller.setSession(session, visibleWindow, 20);

    // First sync: scroll source (left) to line 5.
    (leftEditor as unknown as { visibleRanges: readonly vscode.Range[] }).visibleRanges = [new vscode.Range(5, 0, 15, 0)];
    await invokeVisibleRangeChange(controller, leftEditor);
    await clock.tickAsync(40);

    assert.strictEqual((middleEditor.revealRange as sinon.SinonSpy).callCount, 1);
    assert.strictEqual(((middleEditor.revealRange as sinon.SinonSpy).firstCall.args[0] as vscode.Range).start.line, 5);

    // Second sync immediately after: scroll source to line 10.
    // The source editor should NOT be suppressed even though peers were just revealed.
    (leftEditor as unknown as { visibleRanges: readonly vscode.Range[] }).visibleRanges = [new vscode.Range(10, 0, 20, 0)];
    await invokeVisibleRangeChange(controller, leftEditor);
    await clock.tickAsync(40);

    assert.strictEqual((middleEditor.revealRange as sinon.SinonSpy).callCount, 2);
    assert.strictEqual(((middleEditor.revealRange as sinon.SinonSpy).secondCall.args[0] as vscode.Range).start.line, 10);
    assert.strictEqual((rightEditor.revealRange as sinon.SinonSpy).callCount, 2);
    assert.strictEqual(((rightEditor.revealRange as sinon.SinonSpy).secondCall.args[0] as vscode.Range).start.line, 10);

    controller.dispose();
    clock.restore();
  });

  test('suppresses echo events from peer editors after sync', async () => {
    const clock = sinon.useFakeTimers({ shouldClearNativeTimers: true });
    stubEditorConfigNoPadding();
    const sessionService = new SessionService();
    const uriFactory = new UriFactory(new RepositoryRegistry());
    const session = sessionService.createBrowserSession(createSession('session-peer-suppress', 3));
    const visibleWindow = sessionService.getVisibleWindow(session);
    const bindings = createCompareBindings(session, uriFactory, visibleWindow.startRevisionIndex);
    sessionService.replaceVisibleWindowBindings(session.id, bindings);

    const leftEditor = createEditor(bindings[0].documentUri, 120, [new vscode.Range(0, 0, 10, 0)]);
    const middleEditor = createEditor(bindings[1].documentUri, 120, [new vscode.Range(0, 0, 10, 0)]);
    const rightEditor = createEditor(bindings[2].documentUri, 120, [new vscode.Range(0, 0, 10, 0)]);
    stubWindowEditors(leftEditor, [leftEditor, middleEditor, rightEditor]);

    const controller = new EditorSyncController(sessionService);
    controller.setSession(session, visibleWindow, 21);

    // Sync: scroll source (left) to line 5.
    (leftEditor as unknown as { visibleRanges: readonly vscode.Range[] }).visibleRanges = [new vscode.Range(5, 0, 15, 0)];
    await invokeVisibleRangeChange(controller, leftEditor);
    await clock.tickAsync(40);

    assert.strictEqual((middleEditor.revealRange as sinon.SinonSpy).callCount, 1);

    // Simulate an echo event from the middle peer (it was just revealed to line 5).
    // This should be suppressed.
    (middleEditor as unknown as { visibleRanges: readonly vscode.Range[] }).visibleRanges = [new vscode.Range(5, 0, 15, 0)];
    await invokeVisibleRangeChange(controller, middleEditor);
    await clock.tickAsync(40);

    // The echo should NOT cause the left or right editors to be revealed again.
    assert.strictEqual((leftEditor.revealRange as sinon.SinonSpy).callCount, 0);

    controller.dispose();
    clock.restore();
  });

  test('compensates for sticky scroll padding when revealing peer editors at top', async () => {
    const clock = sinon.useFakeTimers({ shouldClearNativeTimers: true });
    sinon.stub(vscode.workspace, 'getConfiguration').callsFake(((section?: string) => ({
      get<T>(setting: string, defaultValue?: T): T | undefined {
        if (section === 'editor' && setting === 'stickyScroll.enabled') {
          return true as T;
        }

        if (section === 'editor' && setting === 'stickyScroll.maxLineCount') {
          return 5 as T;
        }

        if (section === 'editor' && setting === 'cursorSurroundingLines') {
          return 0 as T;
        }

        return defaultValue;
      }
    })) as typeof vscode.workspace.getConfiguration);

    const sessionService = new SessionService();
    const uriFactory = new UriFactory(new RepositoryRegistry());
    const session = sessionService.createBrowserSession(createSession('session-sticky-compensate', 3));
    const visibleWindow = sessionService.getVisibleWindow(session);
    const bindings = createCompareBindings(session, uriFactory, visibleWindow.startRevisionIndex);
    sessionService.replaceVisibleWindowBindings(session.id, bindings);

    const leftEditor = createEditor(bindings[0].documentUri, 120, [new vscode.Range(0, 0, 10, 0)]);
    const sourceEditor = createEditor(bindings[1].documentUri, 120, [new vscode.Range(20, 0, 30, 0)]);
    const rightEditor = createEditor(bindings[2].documentUri, 120, [new vscode.Range(0, 0, 10, 0)]);
    stubWindowEditors(undefined, [leftEditor, sourceEditor, rightEditor]);

    const controller = new EditorSyncController(sessionService);
    controller.setSession(session, visibleWindow, 30);

    await invokeVisibleRangeChange(controller, sourceEditor);
    await clock.tickAsync(40);

    // With sticky scroll padding = 5, revealLineAtTop should add 5 to the target line
    // so that after VS Code subtracts its internal padding, the raw scroll position matches.
    assert.strictEqual((leftEditor.revealRange as sinon.SinonSpy).callCount, 1);
    assert.strictEqual((rightEditor.revealRange as sinon.SinonSpy).callCount, 1);
    const leftRevealLine = ((leftEditor.revealRange as sinon.SinonSpy).firstCall.args[0] as vscode.Range).start.line;
    const rightRevealLine = ((rightEditor.revealRange as sinon.SinonSpy).firstCall.args[0] as vscode.Range).start.line;
    assert.strictEqual(leftRevealLine, 25, 'left editor should reveal at target (20) + padding (5) = 25');
    assert.strictEqual(rightRevealLine, 25, 'right editor should reveal at target (20) + padding (5) = 25');

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
    pairProjection: { mode: 'adjacent' },
    surfaceMode: 'native'
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
    revealRange: sinon.spy((range: vscode.Range) => {
      const lastLine = Math.max(range.start.line, lineCount - 1);
      editor.visibleRanges = [new vscode.Range(range.start.line, 0, lastLine, 0)];
    }),
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

function stubEditorScrollCommand(activeEditor: vscode.TextEditor & { visibleRanges: readonly vscode.Range[] }): sinon.SinonStub {
  return sinon.stub(vscode.commands, 'executeCommand').callsFake(async (...args: unknown[]) => {
    const command = args[0];
    const options = args[1] as { readonly to?: string; readonly value?: number } | undefined;
    if (command === 'editorScroll') {
      const direction = options?.to === 'up' ? -1 : 1;
      const value = Math.max(1, options?.value ?? 1);
      const currentTop = activeEditor.visibleRanges[0]?.start.line ?? 0;
      const nextTop = Math.max(0, currentTop + (direction * value));
      activeEditor.visibleRanges = [new vscode.Range(nextTop, 0, nextTop + 10, 0)];
    }

    return undefined;
  });
}

function stubEditorConfigNoPadding(): void {
  sinon.stub(vscode.workspace, 'getConfiguration').callsFake(((section?: string) => ({
    get<T>(setting: string, defaultValue?: T): T | undefined {
      if (section === 'editor' && setting === 'stickyScroll.enabled') {
        return false as T;
      }

      if (section === 'editor' && setting === 'cursorSurroundingLines') {
        return 0 as T;
      }

      return defaultValue;
    }
  })) as typeof vscode.workspace.getConfiguration);
}
