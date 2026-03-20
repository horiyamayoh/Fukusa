import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';

import { NWayCompareSession, RepoContext, RevisionRef } from '../../adapters/common/types';
import { RepositoryRegistry } from '../../application/repositoryRegistry';
import { SessionService } from '../../application/sessionService';
import { UriFactory } from '../../infrastructure/fs/uriFactory';
import { PanelCompareSessionController } from '../../presentation/compare/panelCompareSessionController';
import { OutputLogger } from '../../util/output';

suite('Unit: PanelCompareSessionController', () => {
  teardown(() => {
    sinon.restore();
  });

  test('renders the panel webview with a dedicated scroll surface', async () => {
    const harness = createPanelHarness();
    sinon.stub(vscode.window, 'createWebviewPanel').callsFake(harness.createPanel as typeof vscode.window.createWebviewPanel);

    const sessionService = new SessionService();
    const controller = new PanelCompareSessionController(
      vscode.Uri.file('c:/extension'),
      sessionService,
      new OutputLogger('PanelCompareSessionController Test')
    );
    const session = sessionService.createBrowserSession(createSession('panel-session-scroll', createRevisions(3)));

    await controller.openSession(session);

    const html = harness.panels[0]?.panel.webview.html ?? '';
    assert.match(html, /html\s*\{\s*height:\s*100%;\s*\}/);
    assert.match(html, /\.surface\s*\{[^}]*min-height:\s*0;[^}]*overflow:\s*auto;[^}]*overflow-anchor:\s*none;/s);
    assert.match(html, /function captureCurrentScrollPosition\(\)/);
    assert.match(html, /function captureViewportAnchor\(\)/);
    assert.match(html, /function updateLayoutMetrics\(\)/);
    assert.match(html, /function getActionTarget\(event, selector\)/);
    assert.match(html, /function getAnchoredScrollTop\(\)/);
    assert.match(html, /function findAnchorRowIndex\(anchorRowNumber\)/);
    assert.match(html, /function renderRows\(forceRender = false\)/);
    assert.match(html, /collapsed gaps:/);
    assert.match(html, /expanded gaps:/);
    assert.match(html, /data-switch-surface/);
    assert.match(html, /data-change-pair-projection/);
    assert.match(html, /data-expand-all-gaps/);
    assert.match(html, /data-reset-expanded-gaps/);
    assert.match(html, /let hasPendingInitialScrollRestore = false;/);
    assert.match(html, /anchorRowNumber:\s*undefined,\s*anchorRowOffset:\s*0,/s);
    assert.match(html, /if \(typeof previousState\.scrollTop === 'number'\) \{\s*runtime\.scrollTop = previousState\.scrollTop;\s*hasPendingInitialScrollRestore = true;\s*\}/s);
    assert.match(html, /if \(typeof previousState\.anchorRowNumber === 'number'\) \{\s*runtime\.anchorRowNumber = previousState\.anchorRowNumber;\s*hasPendingInitialScrollRestore = true;\s*\}/s);
    assert.match(html, /if \(!hasPendingInitialScrollRestore\) \{\s*captureCurrentScrollPosition\(\);\s*\}/s);
    assert.match(html, /captureViewportAnchor\(\);\s*renderRows\(\);\s*hasPendingInitialScrollRestore = false;\s*syncScrollState\(\);/s);
    assert.match(html, /anchorRowNumber:\s*runtime\.anchorRowNumber,\s*anchorRowOffset:\s*runtime\.anchorRowOffset/s);
    assert.match(html, /changePairProjectionButton\.toggleAttribute\('disabled', !viewModel\.canChangePairProjection\)/);
    assert.match(html, /expandAllGapsButton\.toggleAttribute\('disabled', !viewModel\.collapseUnchanged \|\| viewModel\.collapsedGapCount === 0\)/);
    assert.match(html, /resetExpandedGapsButton\.toggleAttribute\('disabled', !viewModel\.collapseUnchanged \|\| viewModel\.expandedGapCount === 0\)/);
    assert.match(html, /activeSnapshotButton\.toggleAttribute\('disabled', !viewModel\.hasActiveSnapshot\)/);
    assert.match(html, /activePairButton\.toggleAttribute\('disabled', !viewModel\.hasActivePair\)/);

    controller.dispose();
  });

  test('refreshes only the changed panel when another session view state changes', async () => {
    const harness = createPanelHarness();
    sinon.stub(vscode.window, 'createWebviewPanel').callsFake(harness.createPanel as typeof vscode.window.createWebviewPanel);

    const sessionService = new SessionService();
    const controller = new PanelCompareSessionController(
      vscode.Uri.file('c:/extension'),
      sessionService,
      new OutputLogger('PanelCompareSessionController Test')
    );
    const firstSession = sessionService.createBrowserSession(createSession('panel-session-1', createRevisions(3)));
    const secondSession = sessionService.createBrowserSession(createSession('panel-session-2', createRevisions(3)));

    await controller.openSession(firstSession);
    await controller.openSession(secondSession);
    harness.readyAll();
    await flushAsyncWork();

    const firstPanel = harness.panels[0];
    const secondPanel = harness.panels[1];
    firstPanel.postMessage.resetHistory();
    secondPanel.postMessage.resetHistory();

    sessionService.setActiveRevision(firstSession.id, 1);
    await flushAsyncWork();

    assert.strictEqual(firstPanel.postMessage.callCount, 1);
    assert.strictEqual(secondPanel.postMessage.callCount, 0);

    firstPanel.postMessage.resetHistory();
    secondPanel.postMessage.resetHistory();

    sessionService.setActivePair(firstSession.id, '0:2');
    await flushAsyncWork();

    assert.strictEqual(firstPanel.postMessage.callCount, 1);
    assert.strictEqual(secondPanel.postMessage.callCount, 0);

    controller.dispose();
  });

  test('refreshes the panel when pair projection changes', async () => {
    const harness = createPanelHarness();
    sinon.stub(vscode.window, 'createWebviewPanel').callsFake(harness.createPanel as typeof vscode.window.createWebviewPanel);

    const sessionService = new SessionService();
    const controller = new PanelCompareSessionController(
      vscode.Uri.file('c:/extension'),
      sessionService,
      new OutputLogger('PanelCompareSessionController Test')
    );
    const session = sessionService.createBrowserSession(createSession('panel-session-projection', createRevisions(4)));

    await controller.openSession(session);
    harness.readyAll();
    await flushAsyncWork();

    const panel = harness.panels[0];
    panel.postMessage.resetHistory();

    sessionService.updatePairProjection(session.id, { mode: 'base' });
    await flushAsyncWork();

    assert.strictEqual(panel.postMessage.callCount, 1);

    controller.dispose();
  });

  test('can close only the panel surface while keeping the session alive', async () => {
    const harness = createPanelHarness();
    sinon.stub(vscode.window, 'createWebviewPanel').callsFake(harness.createPanel as typeof vscode.window.createWebviewPanel);

    const sessionService = new SessionService();
    const controller = new PanelCompareSessionController(
      vscode.Uri.file('c:/extension'),
      sessionService,
      new OutputLogger('PanelCompareSessionController Test')
    );
    const session = sessionService.createBrowserSession(createSession('panel-session-close-surface', createRevisions(3)));

    await controller.openSession(session);
    const closed = await controller.closeSessionSurface(session.id);

    assert.strictEqual(closed, true);
    assert.ok(sessionService.getSession(session.id));

    controller.dispose();
  });

  test('routes panel actions through internal targeted commands', async () => {
    const harness = createPanelHarness();
    sinon.stub(vscode.window, 'createWebviewPanel').callsFake(harness.createPanel as typeof vscode.window.createWebviewPanel);
    const executeCommandStub = sinon.stub(vscode.commands, 'executeCommand').resolves(undefined);

    const sessionService = new SessionService();
    const controller = new PanelCompareSessionController(
      vscode.Uri.file('c:/extension'),
      sessionService,
      new OutputLogger('PanelCompareSessionController Test')
    );
    const firstSession = sessionService.createBrowserSession(createSession('panel-session-command-1', createRevisions(3)));
    const secondSession = sessionService.createBrowserSession(createSession('panel-session-command-2', createRevisions(3)));

    await controller.openSession(firstSession);
    await controller.openSession(secondSession);

    harness.panels[0]?.receive({ type: 'changePairProjection' });
    harness.panels[0]?.receive({ type: 'openSnapshot', revisionIndex: 1 });
    harness.panels[0]?.receive({ type: 'openActivePairDiff' });
    await flushAsyncWork();

    assert.ok(executeCommandStub.calledWith('multidiff.internal.changePairProjection', firstSession.id));
    assert.ok(executeCommandStub.calledWith('multidiff.internal.openSessionSnapshot', {
      sessionId: firstSession.id,
      revisionIndex: 1
    }));
    assert.ok(executeCommandStub.calledWith('multidiff.internal.openSessionPairDiff', firstSession.id));
    assert.strictEqual(sessionService.getActiveBrowserSession()?.id, secondSession.id);

    controller.dispose();
  });
});

interface StubPanel {
  readonly panel: vscode.WebviewPanel;
  readonly postMessage: sinon.SinonStub;
  readonly receive: (message: unknown) => void;
}

function createPanelHarness(): {
  readonly panels: StubPanel[];
  readonly createPanel: typeof vscode.window.createWebviewPanel;
  readonly readyAll: () => void;
} {
  const panels: StubPanel[] = [];

  return {
    panels,
    createPanel: ((viewType: string, title: string, showOptions: vscode.ViewColumn, options?: vscode.WebviewPanelOptions & vscode.WebviewOptions) => {
      void viewType;
      void title;
      void showOptions;
      void options;

      const disposeEmitter = new vscode.EventEmitter<void>();
      const viewStateEmitter = new vscode.EventEmitter<vscode.WebviewPanelOnDidChangeViewStateEvent>();
      const messageHandlers: Array<(message: unknown) => void> = [];
      const postMessage = sinon.stub().resolves(true);

      const panel = {
        title,
        active: true,
        viewColumn: vscode.ViewColumn.One,
        webview: {
          html: '',
          options: {},
          cspSource: 'vscode-resource:',
          postMessage,
          onDidReceiveMessage: (handler: (message: unknown) => void) => {
            messageHandlers.push(handler);
            return new vscode.Disposable(() => undefined);
          }
        },
        onDidDispose: disposeEmitter.event,
        onDidChangeViewState: viewStateEmitter.event,
        reveal: sinon.stub(),
        dispose: () => {
          disposeEmitter.fire();
          disposeEmitter.dispose();
          viewStateEmitter.dispose();
        }
      } as unknown as vscode.WebviewPanel;

      panels.push({
        panel,
        postMessage,
        receive: (message: unknown) => {
          for (const handler of messageHandlers) {
            handler(message);
          }
        }
      });

      return panel;
    }) as typeof vscode.window.createWebviewPanel,
    readyAll: () => {
      for (const panel of panels) {
        panel.receive({ type: 'ready' });
      }
    }
  };
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
    rowCount: 2,
    rawSnapshots: revisions.map((revision, index) => ({
      snapshotUri: vscode.Uri.file(`c:/repo/.fukusa-shadow/revisions/${revision.id}/src/sample.ts`),
      rawUri: vscode.Uri.file(`c:/repo/.fukusa-shadow/revisions/${revision.id}/src/sample.ts`),
      revisionIndex: index,
      revisionId: revision.id,
      revisionLabel: revision.shortLabel,
      relativePath: 'src/sample.ts',
      lineMap: {
        rowToOriginalLine: new Map([[1, 1], [2, 2]]),
        originalLineToRow: new Map([[1, 1], [2, 2]])
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
      },
      {
        rowNumber: 2,
        cells: revisions.map((revision, index) => ({
          revisionIndex: index,
          rowNumber: 2,
          present: true,
          text: index === 2 ? `${revision.id}-changed` : revision.id,
          originalLineNumber: 2
        }))
      }
    ],
    adjacentPairs: revisions.slice(0, -1).map((revision, index) => ({
      key: `${index}:${index + 1}`,
      leftRevisionIndex: index,
      rightRevisionIndex: index + 1,
      label: `${revision.shortLabel}-${revisions[index + 1].shortLabel}`,
      changedRowNumbers: [2]
    })),
    pairProjection: { mode: 'all' },
    surfaceMode: 'panel'
  };
}

function createRevisions(count: number): RevisionRef[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `rev-${index}`,
    shortLabel: `r${index}`
  }));
}

async function flushAsyncWork(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}
