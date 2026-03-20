import * as assert from 'assert';
import * as path from 'path';
import * as sinon from 'sinon';
import * as vscode from 'vscode';

import { RepositoryRegistry } from '../../application/repositoryRegistry';
import { SessionService } from '../../application/sessionService';
import { UriFactory } from '../../infrastructure/fs/uriFactory';
import { OutputLogger } from '../../util/output';
import { DiffDecorationController } from '../../presentation/native/diffDecorationController';
import { EditorLayoutController } from '../../presentation/native/editorLayoutController';
import { EditorSyncController } from '../../presentation/native/editorSyncController';
import { NativeCompareSessionController } from '../../presentation/native/nativeCompareSessionController';
import { createRevisions, createSession } from '../helpers/sessionHelpers';

suite('Unit: NativeCompareSessionController', () => {
  teardown(() => {
    sinon.restore();
  });

  test('renders native editors and shifts overflow windows by one revision without leaving stale tabs', async () => {
    const harness = createTabHarness();
    stubTabGroups(harness.tabGroups);
    stubWindowEditorsForHarness(harness);
    stubEditorConfigNoPadding();
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

  test('keeps the session registered when cascading close fails after a user tab close', async () => {
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

    harness.closeStub.callsFake(async () => false);

    const output = new OutputLogger('NativeCompareSessionController Test');
    const warnStub = sinon.stub(output, 'warn');
    const sessionService = new SessionService();
    const controller = new NativeCompareSessionController(
      sessionService,
      uriFactory,
      new TestLayoutController(),
      { refresh: sinon.stub(), dispose: sinon.stub() } as unknown as DiffDecorationController,
      { setSession: sinon.stub(), clear: sinon.stub(), dispose: sinon.stub() } as unknown as EditorSyncController,
      output
    );
    const session = sessionService.createBrowserSession(createSession('session-partial-close', createRevisions(2)));

    await controller.openSession(session);
    const closedTab = harness.openTabs[1];
    harness.userClose(closedTab);
    await flushAsyncWork();

    assert.ok(sessionService.getSession(session.id));
    assert.strictEqual(harness.openTabs.length, 1);
    assert.strictEqual(warnStub.callCount, 1);
    assert.match(String(warnStub.firstCall.args[0]), /Partially closed session/);

    controller.dispose();
  });

  test('rerenders tracked native sessions when shared row projection changes', async () => {
    const harness = createTabHarness();
    stubTabGroups(harness.tabGroups);
    stubWindowEditorsForHarness(harness);
    stubEditorConfigNoPadding();
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

  test('rerenders tracked native sessions when focusing a revision outside the current page', async () => {
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
    const session = sessionService.createBrowserSession(createSession('session-focus-page', createRevisions(11), {
      rowCount: 120
    }));

    await controller.openSession(session);
    sessionService.setActiveRevision(session.id, 10);
    await flushAsyncWork();

    const firstCompareUri = (harness.openTabs[0]?.input as { readonly uri: vscode.Uri }).uri;
    const firstBinding = firstCompareUri ? sessionService.getSessionFileBinding(firstCompareUri) : undefined;

    assert.strictEqual(openTextDocumentStub.callCount, 18);
    assert.strictEqual(sessionService.getSessionViewState(session.id).pageStart, 2);
    assert.strictEqual(firstBinding?.windowStart, 2);
    assert.strictEqual(firstBinding?.revisionIndex, 2);

    controller.dispose();
    editorSyncController.dispose();
  });

  test('does not fall back to full-row bindings when collapse hides an entirely unchanged native window', async () => {
    const harness = createTabHarness();
    stubTabGroups(harness.tabGroups);
    stubWindowEditorsForHarness(harness);
    const uriFactory = new UriFactory(new RepositoryRegistry());

    const openTextDocumentStub = sinon.stub(vscode.workspace, 'openTextDocument').callsFake((async (...args: unknown[]) => {
      const uri = args[0] as vscode.Uri;
      return {
        uri,
        lineCount: 1
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
      'session-projection-empty',
      createRevisions(3),
      { rowCount: 20, changedRowNumbers: [] }
    ));

    await controller.openSession(session);
    sessionService.toggleCollapseUnchanged(session.id);
    await flushAsyncWork();

    const compareUri = (harness.openTabs[0]?.input as { readonly uri: vscode.Uri }).uri;
    const bindingAfterCollapse = compareUri ? sessionService.getSessionFileBinding(compareUri) : undefined;

    assert.strictEqual(openTextDocumentStub.callCount, 6);
    assert.deepStrictEqual(bindingAfterCollapse?.projectedGlobalRows, []);
    assert.strictEqual(bindingAfterCollapse?.projectedLineMap?.documentLineToGlobalRow.size, 0);

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

  test('closes orphaned native tabs when the oldest session is evicted', async () => {
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

    const sessionService = new SessionService(2);
    const controller = new NativeCompareSessionController(
      sessionService,
      uriFactory,
      new TestLayoutController(),
      { refresh: sinon.stub(), dispose: sinon.stub() } as unknown as DiffDecorationController,
      { setSession: sinon.stub(), clear: sinon.stub(), dispose: sinon.stub() } as unknown as EditorSyncController,
      new OutputLogger('NativeCompareSessionController Test')
    );

    const firstSession = sessionService.createBrowserSession(createSession('session-evict-a', createRevisions(2)));
    await controller.openSession(firstSession);
    const secondSession = sessionService.createBrowserSession(createSession('session-evict-b', createRevisions(2)));
    await controller.openSession(secondSession);
    const thirdSession = sessionService.createBrowserSession(createSession('session-evict-c', createRevisions(2)));
    await controller.openSession(thirdSession);
    await flushAsyncWork();

    assert.strictEqual(sessionService.getSession(firstSession.id), undefined);
    assert.strictEqual(harness.openTabs.length, 4);
    assert.ok(harness.openTabs.every((tab) => ((tab.input as { readonly uri: vscode.Uri }).uri.authority !== firstSession.id)));

    controller.dispose();
  });
});

class TestLayoutController extends EditorLayoutController {
  public readonly calls: number[] = [];

  public override async setLayout(columns: number): Promise<void> {
    this.calls.push(columns);
  }
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
