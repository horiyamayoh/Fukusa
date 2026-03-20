import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';

import { SessionService } from '../../application/sessionService';
import { PanelCompareSessionController } from '../../presentation/compare/panelCompareSessionController';
import { OutputLogger } from '../../util/output';
import { createRevisions, createSession } from '../helpers/sessionHelpers';

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
    const session = sessionService.createBrowserSession(createSession('panel-session-scroll', createRevisions(3), {
      rowCount: 2,
      surfaceMode: 'panel',
      changedRowNumbers: [2]
    }));

    await controller.openSession(session);

    const html = harness.panels[0]?.panel.webview.html ?? '';
    assert.ok(html.startsWith('<!DOCTYPE html>'));
    assert.ok(html.includes('<div class="toolbar">'));
    assert.ok(html.includes('<div class="surface" id="surface">'));
    assert.ok(html.includes('<div class="rowsViewport">'));
    assert.ok(html.includes('data-switch-surface'));
    assert.ok(html.includes('data-change-pair-projection'));
    assert.ok(html.includes('data-toggle-collapse'));
    assert.ok(html.includes('data-expand-all-gaps'));
    assert.ok(html.includes('data-reset-expanded-gaps'));
    assert.ok(html.includes('data-open-active-pair'));
    assert.ok(html.includes('data-open-active-snapshot'));
    assert.ok(html.includes('collapsed gaps:'));
    assert.ok(html.includes('expanded gaps:'));
    assert.ok(html.includes('function renderRows(forceRender = false)'));
    assert.ok(html.includes('function getAnchoredScrollTop()'));
    assert.ok(html.includes('let hasPendingInitialScrollRestore = false;'));
    assertHtmlIncludesLabels(html, [
      'Switch Surface',
      'Change Pairs',
      'Collapse Unchanged',
      'Expand All Gaps',
      'Reset Gaps',
      'Native Pair Diff',
      'Active Snapshot'
    ]);

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
    const firstSession = sessionService.createBrowserSession(createSession('panel-session-1', createRevisions(3), {
      rowCount: 2,
      surfaceMode: 'panel',
      changedRowNumbers: [2]
    }));
    const secondSession = sessionService.createBrowserSession(createSession('panel-session-2', createRevisions(3), {
      rowCount: 2,
      surfaceMode: 'panel',
      changedRowNumbers: [2]
    }));

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
    const session = sessionService.createBrowserSession(createSession('panel-session-projection', createRevisions(4), {
      rowCount: 2,
      surfaceMode: 'panel',
      changedRowNumbers: [2]
    }));

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
    const session = sessionService.createBrowserSession(createSession('panel-session-close-surface', createRevisions(3), {
      rowCount: 2,
      surfaceMode: 'panel',
      changedRowNumbers: [2]
    }));

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
    const firstSession = sessionService.createBrowserSession(createSession('panel-session-command-1', createRevisions(3), {
      rowCount: 2,
      surfaceMode: 'panel',
      changedRowNumbers: [2]
    }));
    const secondSession = sessionService.createBrowserSession(createSession('panel-session-command-2', createRevisions(3), {
      rowCount: 2,
      surfaceMode: 'panel',
      changedRowNumbers: [2]
    }));

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

function assertHtmlIncludesLabels(html: string, labels: readonly string[]): void {
  for (const label of labels) {
    assert.ok(html.includes(label), `Expected HTML to include "${label}".`);
  }
}

async function flushAsyncWork(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}
