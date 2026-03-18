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
    const uriFactory = new UriFactory(new RepositoryRegistry());

    const openTextDocumentStub = sinon.stub(vscode.workspace, 'openTextDocument').callsFake((async (...args: unknown[]) => {
      const uri = args[0] as vscode.Uri;
      return {
        uri,
        lineCount: 1
      } as vscode.TextDocument;
    }) as unknown as typeof vscode.workspace.openTextDocument);
    const showTextDocumentStub = sinon.stub(vscode.window, 'showTextDocument').callsFake((async (...args: unknown[]) => {
      const document = args[0] as vscode.TextDocument;
      harness.open(document.uri);
      return {
        document,
        setDecorations: () => undefined,
        revealRange: () => undefined,
        visibleRanges: []
      } as unknown as vscode.TextEditor;
    }) as unknown as typeof vscode.window.showTextDocument);

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
      uriFactory,
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
    assert.strictEqual(harness.closeStub.callCount, 1);
    assert.strictEqual(harness.openTabs.length, 9);
    assert.strictEqual(session.pageStart, 1);
    assert.ok(harness.openTabs.every((tab) => ((tab.input as { readonly uri: vscode.Uri }).uri.scheme === 'multidiff-session-doc')));
    assert.ok(harness.openTabs.every((tab) => path.basename((tab.input as { readonly uri: vscode.Uri }).uri.path).endsWith('sample.ts')));
    assert.strictEqual((editorSyncController.setSession as sinon.SinonStub).callCount >= 2, true);
    assert.strictEqual((diffDecorationController.refresh as sinon.SinonStub).callCount >= 2, true);

    controller.dispose();
  });

  test('closing one tracked tab cascades to the rest of the session and removes it from session service', async () => {
    const harness = createTabHarness();
    stubTabGroups(harness.tabGroups);
    const uriFactory = new UriFactory(new RepositoryRegistry());

    sinon.stub(vscode.workspace, 'openTextDocument').callsFake((async (...args: unknown[]) => {
      const uri = args[0] as vscode.Uri;
      return {
        uri,
        lineCount: 1
      } as vscode.TextDocument;
    }) as unknown as typeof vscode.workspace.openTextDocument);
    sinon.stub(vscode.window, 'showTextDocument').callsFake((async (...args: unknown[]) => {
      const document = args[0] as vscode.TextDocument;
      harness.open(document.uri);
      return {
        document,
        setDecorations: () => undefined,
        revealRange: () => undefined,
        visibleRanges: []
      } as unknown as vscode.TextEditor;
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

function stubTabGroups(tabGroups: vscode.TabGroups): void {
  (sinon as unknown as {
    replaceGetter(object: object, property: string, getter: () => unknown): void;
  }).replaceGetter(vscode.window, 'tabGroups', () => tabGroups);
}

function createTabHarness(): {
  readonly tabGroups: vscode.TabGroups;
  readonly closeStub: sinon.SinonStub;
  readonly openTabs: vscode.Tab[];
  readonly open: (uri: vscode.Uri) => void;
  readonly userClose: (tab: vscode.Tab) => void;
} {
  const tabs: vscode.Tab[] = [];
  const tabChangeEmitter = new vscode.EventEmitter<vscode.TabChangeEvent>();
  const tabGroupChangeEmitter = new vscode.EventEmitter<vscode.TabGroupChangeEvent>();

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
      tabs.splice(tabs.indexOf(tab), 1);
    }

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

  function open(uri: vscode.Uri): void {
    if (tabs.some((tab) => ((tab.input as { readonly uri: vscode.Uri }).uri.toString(true) === uri.toString(true)))) {
      return;
    }

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

  function userClose(tab: vscode.Tab): void {
    const index = tabs.indexOf(tab);
    if (index >= 0) {
      tabs.splice(index, 1);
    }

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
    open,
    userClose
  };
}

async function flushAsyncWork(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}
