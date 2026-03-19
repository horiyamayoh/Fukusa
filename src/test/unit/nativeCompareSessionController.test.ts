import * as assert from 'assert';
import * as path from 'path';
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

  test('renders native editors and shifts overflow windows by one revision without leaving stale tabs', async () => {
    const harness = createTabHarness();
    stubTabGroups(harness.tabGroups);
    stubWindowEditorsForHarness(harness);
    const uriFactory = new UriFactory(new RepositoryRegistry());

    const openTextDocumentStub = sinon.stub(vscode.workspace, 'openTextDocument').callsFake((async (...args: unknown[]) => {
      const uri = args[0] as vscode.Uri;
      return {
        uri,
        lineCount: 200
      } as vscode.TextDocument;
    }) as unknown as typeof vscode.workspace.openTextDocument);
    const showTextDocumentStub = sinon.stub(vscode.window, 'showTextDocument').callsFake((async (...args: unknown[]) => {
      const document = args[0] as vscode.TextDocument;
      return harness.open(document, args[1] as vscode.TextDocumentShowOptions | undefined);
    }) as unknown as typeof vscode.window.showTextDocument);

    const layoutController = new TestLayoutController();
    const sessionService = new SessionService();
    const diffDecorationController = { refresh: sinon.stub(), dispose: sinon.stub() } as unknown as DiffDecorationController;
    const editorSyncController = new EditorSyncController(sessionService);
    const setSessionSpy = sinon.spy(editorSyncController, 'setSession');
    const controller = new NativeCompareSessionController(
      sessionService,
      uriFactory,
      layoutController,
      diffDecorationController,
      editorSyncController,
      new OutputLogger('NativeCompareSessionController Test')
    );
    const session = sessionService.createBrowserSession(createSession('session-1', createRevisions(10), {
      rowCount: 120
    }));

    await controller.openSession(session);
    if (harness.activeEditor) {
      harness.activeEditor.visibleRanges = [new vscode.Range(42, 0, 55, 0)];
    }
    await controller.shiftWindow(1);

    assert.deepStrictEqual(layoutController.calls, [9, 9]);
    assert.strictEqual(openTextDocumentStub.callCount, 18);
    assert.strictEqual(showTextDocumentStub.callCount, 18);
    assert.strictEqual(harness.closeStub.callCount, 1);
    assert.strictEqual(harness.openTabs.length, 9);
    assert.strictEqual(sessionService.getSessionViewState(session.id).pageStart, 1);
    assert.ok(harness.openTabs.every((tab) => ((tab.input as { readonly uri: vscode.Uri }).uri.scheme === 'multidiff-session-doc')));
    assert.ok(harness.openTabs.every((tab) => path.basename((tab.input as { readonly uri: vscode.Uri }).uri.path).endsWith('sample.ts')));
    assert.ok(harness.visibleEditors.every((editor) => editor.visibleRanges[0]?.start.line === 42));
    assert.strictEqual(setSessionSpy.callCount >= 2, true);
    assert.strictEqual((diffDecorationController.refresh as sinon.SinonStub).callCount >= 2, true);

    controller.dispose();
    editorSyncController.dispose();
  });

  test('closing one tracked tab cascades to the rest of the session and removes it from session service', async () => {
    const harness = createTabHarness();
    stubTabGroups(harness.tabGroups);
    stubWindowEditorsForHarness(harness);
    const uriFactory = new UriFactory(new RepositoryRegistry());

    sinon.stub(vscode.workspace, 'openTextDocument').callsFake((async (...args: unknown[]) => {
      const uri = args[0] as vscode.Uri;
      return {
        uri,
        lineCount: 200
      } as vscode.TextDocument;
    }) as unknown as typeof vscode.workspace.openTextDocument);
    sinon.stub(vscode.window, 'showTextDocument').callsFake((async (...args: unknown[]) => {
      const document = args[0] as vscode.TextDocument;
      return harness.open(document, args[1] as vscode.TextDocumentShowOptions | undefined);
    }) as unknown as typeof vscode.window.showTextDocument);

    const sessionService = new SessionService();
    const controller = new NativeCompareSessionController(
      sessionService,
      uriFactory,
      new TestLayoutController(),
      { refresh: sinon.stub(), dispose: sinon.stub() } as unknown as DiffDecorationController,
      { setSession: sinon.stub(), clear: sinon.stub(), dispose: sinon.stub() } as unknown as EditorSyncController,
      new OutputLogger('NativeCompareSessionController Test')
    );
    const session = sessionService.createBrowserSession(createSession('session-2', createRevisions(3)));

    await controller.openSession(session);
    const closedTab = harness.openTabs[1];
    harness.userClose(closedTab);
    await flushAsyncWork();

    assert.strictEqual(harness.closeStub.callCount, 1);
    assert.strictEqual(harness.openTabs.length, 0);
    assert.strictEqual(sessionService.getSession(session.id), undefined);

    controller.dispose();
  });

  test('rerenders tracked native sessions when shared row projection changes', async () => {
    const harness = createTabHarness();
    stubTabGroups(harness.tabGroups);
    stubWindowEditorsForHarness(harness);
    const uriFactory = new UriFactory(new RepositoryRegistry());

    const openTextDocumentStub = sinon.stub(vscode.workspace, 'openTextDocument').callsFake((async (...args: unknown[]) => {
      const uri = args[0] as vscode.Uri;
      return {
        uri,
        lineCount: 200
      } as vscode.TextDocument;
    }) as unknown as typeof vscode.workspace.openTextDocument);
    sinon.stub(vscode.window, 'showTextDocument').callsFake((async (...args: unknown[]) => {
      const document = args[0] as vscode.TextDocument;
      return harness.open(document, args[1] as vscode.TextDocumentShowOptions | undefined);
    }) as unknown as typeof vscode.window.showTextDocument);

    const sessionService = new SessionService();
    const editorSyncController = new EditorSyncController(sessionService);
    const controller = new NativeCompareSessionController(
      sessionService,
      uriFactory,
      new TestLayoutController(),
      { refresh: sinon.stub(), dispose: sinon.stub() } as unknown as DiffDecorationController,
      editorSyncController,
      new OutputLogger('NativeCompareSessionController Test')
    );
    const session = sessionService.createBrowserSession(createSession(
      'session-projection',
      createRevisions(3),
      { rowCount: 20, changedRowNumbers: [10] }
    ));

    await controller.openSession(session);
    if (harness.activeEditor) {
      harness.activeEditor.visibleRanges = [new vscode.Range(11, 0, 15, 0)];
    }
    sessionService.toggleCollapseUnchanged(session.id);
    await flushAsyncWork();

    const compareUri = (harness.openTabs[0]?.input as { readonly uri: vscode.Uri }).uri;
    const bindingAfterCollapse = compareUri ? sessionService.getSessionFileBinding(compareUri) : undefined;

    assert.strictEqual(openTextDocumentStub.callCount, 6);
    assert.deepStrictEqual(bindingAfterCollapse?.projectedGlobalRows, [7, 8, 9, 10, 11, 12, 13]);
    assert.ok(harness.visibleEditors.every((editor) => editor.visibleRanges[0]?.start.line === 5));

    sessionService.expandProjectionGap(session.id, '14:20');
    await flushAsyncWork();
    const bindingAfterExpand = compareUri ? sessionService.getSessionFileBinding(compareUri) : undefined;

    assert.strictEqual(openTextDocumentStub.callCount, 9);
    assert.deepStrictEqual(bindingAfterExpand?.projectedGlobalRows, [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    assert.ok(harness.visibleEditors.every((editor) => editor.visibleRanges[0]?.start.line === 5));

    controller.dispose();
    editorSyncController.dispose();
  });

  test('can close only the native surface while keeping the session alive', async () => {
    const harness = createTabHarness();
    stubTabGroups(harness.tabGroups);
    stubWindowEditorsForHarness(harness);
    const uriFactory = new UriFactory(new RepositoryRegistry());

    sinon.stub(vscode.workspace, 'openTextDocument').callsFake((async (...args: unknown[]) => {
      const uri = args[0] as vscode.Uri;
      return {
        uri,
        lineCount: 200
      } as vscode.TextDocument;
    }) as unknown as typeof vscode.workspace.openTextDocument);
    sinon.stub(vscode.window, 'showTextDocument').callsFake((async (...args: unknown[]) => {
      const document = args[0] as vscode.TextDocument;
      return harness.open(document, args[1] as vscode.TextDocumentShowOptions | undefined);
    }) as unknown as typeof vscode.window.showTextDocument);

    const diffDecorationController = { refresh: sinon.stub(), dispose: sinon.stub() } as unknown as DiffDecorationController;
    const sessionService = new SessionService();
    const editorSyncController = new EditorSyncController(sessionService);
    const controller = new NativeCompareSessionController(
      sessionService,
      uriFactory,
      new TestLayoutController(),
      diffDecorationController,
      editorSyncController,
      new OutputLogger('NativeCompareSessionController Test')
    );
    const session = sessionService.createBrowserSession(createSession('session-surface-close', createRevisions(3)));

    await controller.openSession(session);
    const closed = await controller.closeSessionSurface(session.id);

    assert.strictEqual(closed, true);
    assert.strictEqual(harness.openTabs.length, 0);
    assert.ok(sessionService.getSession(session.id));
    assert.strictEqual((diffDecorationController.refresh as sinon.SinonStub).callCount >= 1, true);

    controller.dispose();
    editorSyncController.dispose();
  });

  test('reveals an already-open native session without rerendering every tracked tab', async () => {
    const harness = createTabHarness();
    stubTabGroups(harness.tabGroups);
    stubWindowEditorsForHarness(harness);
    const uriFactory = new UriFactory(new RepositoryRegistry());

    const openTextDocumentStub = sinon.stub(vscode.workspace, 'openTextDocument').callsFake((async (...args: unknown[]) => {
      const uri = args[0] as vscode.Uri;
      return {
        uri,
        lineCount: 200
      } as vscode.TextDocument;
    }) as unknown as typeof vscode.workspace.openTextDocument);
    const showTextDocumentStub = sinon.stub(vscode.window, 'showTextDocument').callsFake((async (...args: unknown[]) => {
      const document = args[0] as vscode.TextDocument;
      return harness.open(document, args[1] as vscode.TextDocumentShowOptions | undefined);
    }) as unknown as typeof vscode.window.showTextDocument);

    const sessionService = new SessionService();
    const controller = new NativeCompareSessionController(
      sessionService,
      uriFactory,
      new TestLayoutController(),
      { refresh: sinon.stub(), dispose: sinon.stub() } as unknown as DiffDecorationController,
      { setSession: sinon.stub(), clear: sinon.stub(), dispose: sinon.stub() } as unknown as EditorSyncController,
      new OutputLogger('NativeCompareSessionController Test')
    );
    const session = sessionService.createBrowserSession(createSession('session-reveal', createRevisions(3)));

    await controller.openSession(session);
    sessionService.setActiveRevision(session.id, 2);
    const openCallsAfterRender = openTextDocumentStub.callCount;
    const showCallsAfterRender = showTextDocumentStub.callCount;

    await controller.revealSession(session.id);

    assert.strictEqual(harness.closeStub.callCount, 0);
    assert.strictEqual(openTextDocumentStub.callCount, openCallsAfterRender + 1);
    assert.strictEqual(showTextDocumentStub.callCount, showCallsAfterRender + 1);
    assert.strictEqual(harness.openTabs.length, 3);

    controller.dispose();
  });
});

class TestLayoutController extends EditorLayoutController {
  public readonly calls: number[] = [];

  public override async setLayout(columns: number): Promise<void> {
    this.calls.push(columns);
  }
}

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

function stubTabGroups(tabGroups: vscode.TabGroups): void {
  (sinon as unknown as {
    replaceGetter(object: object, property: string, getter: () => unknown): void;
  }).replaceGetter(vscode.window, 'tabGroups', () => tabGroups);
}

function createTabHarness(): {
  readonly tabGroups: vscode.TabGroups;
  readonly closeStub: sinon.SinonStub;
  readonly openTabs: vscode.Tab[];
  readonly visibleEditors: TestEditor[];
  readonly activeEditor: TestEditor | undefined;
  readonly open: (document: vscode.TextDocument, options?: vscode.TextDocumentShowOptions) => TestEditor;
  readonly getEditor: (uri: vscode.Uri) => TestEditor | undefined;
  readonly userClose: (tab: vscode.Tab) => void;
} {
  const tabs: vscode.Tab[] = [];
  const editors = new Map<string, TestEditor>();
  const tabChangeEmitter = new vscode.EventEmitter<vscode.TabChangeEvent>();
  const tabGroupChangeEmitter = new vscode.EventEmitter<vscode.TabGroupChangeEvent>();
  let activeEditor: TestEditor | undefined;

  const group = {
    isActive: true,
    viewColumn: vscode.ViewColumn.One,
    get activeTab(): vscode.Tab | undefined {
      return tabs[0];
    },
    get tabs(): readonly vscode.Tab[] {
      return tabs;
    }
  } as vscode.TabGroup;

  const closeStub = sinon.stub().callsFake(async (target: vscode.Tab | readonly vscode.Tab[]) => {
    const closing = Array.isArray(target) ? [...target] : [target];
    const closingSet = new Set(closing);
    const closedTabs = tabs.filter((tab) => closingSet.has(tab));
    for (const tab of closedTabs) {
      const uri = (tab.input as { readonly uri: vscode.Uri }).uri;
      editors.delete(uri.toString(true));
      tabs.splice(tabs.indexOf(tab), 1);
    }
    activeEditor = [...editors.values()][0];

    tabChangeEmitter.fire({
      opened: [],
      closed: closedTabs,
      changed: []
    });
    return true;
  });

  const tabGroups = {
    all: [group],
    activeTabGroup: group,
    onDidChangeTabs: tabChangeEmitter.event,
    onDidChangeTabGroups: tabGroupChangeEmitter.event,
    close: closeStub
  } as unknown as vscode.TabGroups;

  function open(document: vscode.TextDocument, options?: vscode.TextDocumentShowOptions): TestEditor {
    const uri = document.uri;
    const uriKey = uri.toString(true);
    const existingTab = tabs.find((tab) => ((tab.input as { readonly uri: vscode.Uri }).uri.toString(true) === uriKey));
    if (!existingTab) {
      tabs.push({
        label: path.basename(uri.fsPath),
        group,
        input: { uri } as unknown as vscode.TabInputText,
        isActive: false,
        isDirty: false,
        isPinned: true,
        isPreview: false
      });
    }

    const editor = createEditor(document, [new vscode.Range(0, 0, 10, 0)]);
    editors.set(uriKey, editor);
    if (!activeEditor || options?.preserveFocus === false) {
      activeEditor = editor;
    }

    return editor;
  }

  function getEditor(uri: vscode.Uri): TestEditor | undefined {
    return editors.get(uri.toString(true));
  }

  function userClose(tab: vscode.Tab): void {
    const index = tabs.indexOf(tab);
    if (index >= 0) {
      tabs.splice(index, 1);
    }
    const uri = (tab.input as { readonly uri: vscode.Uri }).uri;
    editors.delete(uri.toString(true));
    activeEditor = [...editors.values()][0];

    tabChangeEmitter.fire({
      opened: [],
      closed: [tab],
      changed: []
    });
  }

  return {
    tabGroups,
    closeStub,
    openTabs: tabs,
    get visibleEditors(): TestEditor[] {
      return [...editors.values()];
    },
    get activeEditor(): TestEditor | undefined {
      return activeEditor;
    },
    open,
    getEditor,
    userClose
  };
}

interface TestEditor extends vscode.TextEditor {
  visibleRanges: readonly vscode.Range[];
}

function createEditor(document: vscode.TextDocument, initialVisibleRanges: readonly vscode.Range[]): TestEditor {
  const editor = {
    document,
    visibleRanges: [...initialVisibleRanges],
    revealRange: sinon.spy((range: vscode.Range) => {
      const lastLine = Math.max(range.start.line, document.lineCount - 1);
      editor.visibleRanges = [new vscode.Range(range.start.line, 0, lastLine, 0)];
    }),
    setDecorations: () => undefined
  } as unknown as TestEditor;

  return editor;
}

function stubWindowEditorsForHarness(harness: {
  readonly visibleEditors: readonly vscode.TextEditor[];
  readonly activeEditor: vscode.TextEditor | undefined;
}): void {
  (sinon as unknown as {
    replaceGetter(object: object, property: string, getter: () => unknown): void;
  }).replaceGetter(vscode.window, 'activeTextEditor', () => harness.activeEditor);
  (sinon as unknown as {
    replaceGetter(object: object, property: string, getter: () => unknown): void;
  }).replaceGetter(vscode.window, 'visibleTextEditors', () => harness.visibleEditors);
}

async function flushAsyncWork(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}
