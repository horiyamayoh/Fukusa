import * as vscode from 'vscode';

import { NWayCompareSession } from '../../adapters/common/types';
import { SessionService } from '../../application/sessionService';
import { OutputLogger } from '../../util/output';
import { buildComparePanelViewModel, ComparePanelViewModel } from './comparePanelDocument';

interface PanelState {
  readonly panel: vscode.WebviewPanel;
  ready: boolean;
  pendingViewModel?: ComparePanelViewModel;
}

type PanelMessage =
  | { readonly type: 'ready' }
  | { readonly type: 'switchCompareSurface' }
  | { readonly type: 'toggleCollapseUnchanged' }
  | { readonly type: 'changePairProjection' }
  | { readonly type: 'expandAllCollapsedGaps' }
  | { readonly type: 'resetExpandedGaps' }
  | { readonly type: 'expandGap'; readonly gapKey: string }
  | { readonly type: 'focusRevision'; readonly revisionIndex: number }
  | { readonly type: 'focusPair'; readonly pairKey: string }
  | { readonly type: 'openSnapshot'; readonly revisionIndex: number }
  | { readonly type: 'openActiveSnapshot' }
  | { readonly type: 'openActivePairDiff' };

export class PanelCompareSessionController implements vscode.Disposable {
  private readonly panels = new Map<string, PanelState>();
  private readonly internallyClosingSessions = new Set<string>();
  private readonly disposables: vscode.Disposable[] = [];

  public constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly sessionService: SessionService,
    private readonly output: OutputLogger
  ) {
    this.disposables.push(
      this.sessionService.onDidChangeSessions(() => {
        this.reconcilePanels();
      }),
      this.sessionService.onDidChangeSessionViewState((sessionId) => {
        void this.refreshPanelById(sessionId);
      }),
      this.sessionService.onDidChangeSessionProjection((sessionId) => {
        void this.refreshPanelById(sessionId);
      })
    );
  }

  public async openSession(session: NWayCompareSession): Promise<void> {
    this.sessionService.setActiveBrowserSession(session.id);
    const existing = this.panels.get(session.id);
    if (existing) {
      await this.refreshPanel(session, existing);
      existing.panel.reveal(vscode.ViewColumn.Active, false);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'multidiff.comparePanel',
      `Fukusa | ${session.relativePath}`,
      vscode.ViewColumn.Active,
      {
        enableScripts: true
      }
    );
    const state: PanelState = {
      panel,
      ready: false
    };

    panel.onDidDispose(() => {
      this.handlePanelDisposed(session.id);
    });
    panel.onDidChangeViewState((event) => {
      if (event.webviewPanel.active) {
        this.sessionService.setActiveBrowserSession(session.id);
      }
    });
    panel.webview.onDidReceiveMessage((message: PanelMessage) => {
      if (message.type === 'ready') {
        state.ready = true;
        void this.pushViewModel(state);
        return;
      }

      void this.handleMessage(session.id, message);
    });
    panel.webview.html = renderComparePanelHtml(panel.webview, this.extensionUri);

    this.panels.set(session.id, state);
    await this.refreshPanel(session, state);
  }

  public async revealSession(sessionId: string): Promise<void> {
    const session = this.sessionService.getBrowserSession(sessionId);
    if (!session) {
      void vscode.window.showInformationMessage('The requested Fukusa session no longer exists.');
      return;
    }

    await this.openSession(session);
  }

  public async closeActiveSession(): Promise<void> {
    const session = this.sessionService.getActiveBrowserSession();
    if (!session) {
      return;
    }

    await this.closeSessionSurface(session.id);
    this.sessionService.removeSession(session.id);
  }

  public async closeSessionSurface(sessionId: string): Promise<boolean> {
    const state = this.panels.get(sessionId);
    if (!state) {
      return true;
    }

    this.internallyClosingSessions.add(sessionId);
    state.panel.dispose();
    this.internallyClosingSessions.delete(sessionId);
    this.panels.delete(sessionId);
    return true;
  }

  public dispose(): void {
    for (const sessionId of [...this.panels.keys()]) {
      const state = this.panels.get(sessionId);
      if (state) {
        this.internallyClosingSessions.add(sessionId);
        state.panel.dispose();
        this.internallyClosingSessions.delete(sessionId);
      }
    }

    while (this.disposables.length > 0) {
      this.disposables.pop()?.dispose();
    }
  }

  private reconcilePanels(): void {
    for (const [sessionId, state] of this.panels.entries()) {
      const session = this.sessionService.getBrowserSession(sessionId);
      if (!session) {
        this.internallyClosingSessions.add(sessionId);
        state.panel.dispose();
        this.internallyClosingSessions.delete(sessionId);
        this.panels.delete(sessionId);
      }
    }
  }

  private async refreshPanel(session: NWayCompareSession, state: PanelState): Promise<void> {
    const rowProjectionState = this.sessionService.getRowProjectionState(session.id);
    const viewState = this.sessionService.getSessionViewState(session.id);
    state.panel.title = `Fukusa | ${session.relativePath}`;
    state.pendingViewModel = buildComparePanelViewModel(session, viewState, {
      collapseUnchanged: rowProjectionState.collapseUnchanged,
      expandedGapKeys: rowProjectionState.expandedGapKeys
    });
    await this.pushViewModel(state);
  }

  private async refreshPanelById(sessionId: string): Promise<void> {
    const session = this.sessionService.getBrowserSession(sessionId);
    const state = this.panels.get(sessionId);
    if (!session || !state) {
      return;
    }

    await this.refreshPanel(session, state);
  }

  private handlePanelDisposed(sessionId: string): void {
    this.panels.delete(sessionId);
    if (this.internallyClosingSessions.has(sessionId)) {
      return;
    }

    this.sessionService.removeSession(sessionId);
  }

  private async handleMessage(sessionId: string, message: PanelMessage): Promise<void> {
    const session = this.sessionService.getBrowserSession(sessionId);
    const state = this.panels.get(sessionId);
    if (!session || !state) {
      return;
    }

    switch (message.type) {
      case 'switchCompareSurface':
        await this.executeTargetedCommand('multidiff.internal.switchCompareSurface', sessionId);
        return;
      case 'toggleCollapseUnchanged':
        await this.executeTargetedCommand('multidiff.internal.toggleCollapseUnchanged', sessionId);
        return;
      case 'changePairProjection':
        await this.executeTargetedCommand('multidiff.internal.changePairProjection', sessionId);
        return;
      case 'expandAllCollapsedGaps':
        await this.executeTargetedCommand('multidiff.internal.expandAllCollapsedGaps', sessionId);
        return;
      case 'resetExpandedGaps':
        await this.executeTargetedCommand('multidiff.internal.resetExpandedGaps', sessionId);
        return;
      case 'expandGap':
        this.sessionService.expandProjectionGap(sessionId, message.gapKey);
        return;
      case 'focusRevision':
        this.sessionService.setActiveRevision(sessionId, message.revisionIndex);
        return;
      case 'focusPair':
        this.sessionService.setActivePair(sessionId, message.pairKey);
        return;
      case 'openSnapshot':
        await this.executeTargetedCommand('multidiff.internal.openSessionSnapshot', {
          sessionId,
          revisionIndex: message.revisionIndex
        });
        return;
      case 'openActiveSnapshot':
        await this.executeTargetedCommand('multidiff.internal.openSessionSnapshot', sessionId);
        return;
      case 'openActivePairDiff':
        await this.executeTargetedCommand('multidiff.internal.openSessionPairDiff', sessionId);
        return;
      default:
        return;
    }
  }

  private async executeTargetedCommand(command: string, target: unknown): Promise<void> {
    this.output.info(`Panel dispatch: ${command} (${describeTarget(target)}).`);
    await vscode.commands.executeCommand(command, target);
  }

  private async pushViewModel(state: PanelState): Promise<void> {
    if (!state.ready || !state.pendingViewModel) {
      return;
    }

    const viewModel = state.pendingViewModel;
    state.pendingViewModel = undefined;
    await state.panel.webview.postMessage({
      type: 'render',
      viewModel
    });
  }
}

function renderComparePanelHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  void extensionUri;
  const nonce = createNonce();

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      :root {
        color-scheme: light dark;
        --gutter-width: 68px;
        --cell-width: 320px;
        --row-height: 36px;
        --header-height: 44px;
      }
      html {
        height: 100%;
      }
      body {
        margin: 0;
        height: 100%;
        color: var(--vscode-editor-foreground);
        background:
          radial-gradient(circle at top left, rgba(208, 126, 48, 0.12), transparent 24%),
          radial-gradient(circle at top right, rgba(64, 124, 192, 0.12), transparent 28%),
          linear-gradient(180deg, rgba(14, 20, 24, 0.98), rgba(10, 12, 18, 1));
        font-family: Consolas, "Liberation Mono", Menlo, monospace;
        overflow: hidden;
      }
      .shell {
        display: grid;
        grid-template-rows: auto auto 1fr;
        height: 100%;
        min-height: 100%;
        overflow: hidden;
      }
      .toolbar {
        position: sticky;
        top: 0;
        z-index: 5;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        padding: 12px 16px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(10, 12, 18, 0.92);
        backdrop-filter: blur(10px);
      }
      .meta {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
      }
      .metaBadge {
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 999px;
        padding: 4px 10px;
        background: rgba(255, 255, 255, 0.06);
        color: var(--vscode-descriptionForeground);
      }
      .metaPath {
        font-weight: 700;
      }
      .toolbarActions, .pairBar {
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
      }
      .pairBar {
        padding: 10px 16px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        background: rgba(255, 255, 255, 0.03);
      }
      .pairBar:empty::before {
        content: 'No active pairs';
        color: var(--vscode-descriptionForeground);
      }
      .primaryButton, .pillButton, .pairButton, .ghostButton {
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 999px;
        padding: 6px 12px;
        background: rgba(255, 255, 255, 0.07);
        color: inherit;
        cursor: pointer;
        font: inherit;
      }
      .primaryButton {
        background: rgba(208, 126, 48, 0.22);
        border-color: rgba(208, 126, 48, 0.42);
      }
      .primaryButton:disabled, .pillButton:disabled, .pairButton:disabled, .ghostButton:disabled {
        opacity: 0.45;
        cursor: default;
      }
      .pillButton--active {
        background: rgba(82, 180, 110, 0.2);
        border-color: rgba(82, 180, 110, 0.42);
      }
      .pairButton--active, .headerCell--active .ghostButton {
        background: rgba(64, 124, 192, 0.22);
        border-color: rgba(64, 124, 192, 0.42);
      }
      .ghostButton {
        background: transparent;
        text-align: left;
      }
      .surface {
        min-height: 0;
        overflow: auto;
        padding: 16px;
        overflow-anchor: none;
      }
      .gridShell {
        width: max-content;
        min-width: 100%;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 14px;
        overflow: hidden;
      }
      .headerRow, .compareRow {
        display: grid;
        grid-template-columns: var(--grid-template-columns, var(--gutter-width));
        width: max-content;
        min-width: 100%;
      }
      .headerCell, .rowNumber, .cell {
        box-sizing: border-box;
        height: var(--row-height);
        padding: 8px 10px;
        border-right: 1px solid rgba(255, 255, 255, 0.06);
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        white-space: pre;
        overflow: hidden;
        text-overflow: clip;
      }
      .headerCell {
        position: sticky;
        top: 0;
        z-index: 4;
        background: rgba(14, 20, 24, 0.96);
      }
      .headerCell--corner {
        left: 0;
        z-index: 6;
      }
      .rowNumber {
        position: sticky;
        left: 0;
        z-index: 3;
        color: var(--vscode-editorLineNumber-foreground);
        background: rgba(14, 20, 24, 0.96);
        text-align: right;
      }
      .headerCell {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
      }
      .cell {
        background: rgba(255, 255, 255, 0.025);
      }
      .gapCell {
        display: flex;
        align-items: center;
        gap: 12px;
        height: var(--row-height);
        padding: 0 12px;
        border-right: 1px solid rgba(255, 255, 255, 0.06);
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        background: rgba(255, 255, 255, 0.035);
        color: var(--vscode-descriptionForeground);
      }
      .gapLabel {
        letter-spacing: 0.01em;
      }
      .cell--empty {
        color: rgba(255, 255, 255, 0.16);
      }
      .cell--edge-prev {
        box-shadow: inset 3px 0 0 rgba(110, 170, 255, 0.28);
      }
      .cell--edge-next {
        box-shadow: inset -3px 0 0 rgba(255, 146, 93, 0.28);
      }
      .cell--active-added {
        background: rgba(82, 180, 110, 0.18);
      }
      .cell--active-removed {
        background: rgba(212, 96, 96, 0.16);
      }
      .cell--active-modified {
        background: rgba(214, 182, 72, 0.14);
      }
      .seg--added {
        background: rgba(82, 180, 110, 0.28);
      }
      .seg--removed {
        background: rgba(212, 96, 96, 0.24);
      }
      .topSpacer, .bottomSpacer {
        width: 1px;
        overflow-anchor: none;
      }
      .rowsViewport {
        overflow-anchor: none;
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <div class="toolbar">
        <div class="meta" id="meta"></div>
        <div class="toolbarActions">
          <button class="pillButton" data-switch-surface>Switch Surface</button>
          <button class="pillButton" data-change-pair-projection>Change Pairs</button>
          <button class="pillButton" data-toggle-collapse>Collapse Unchanged</button>
          <button class="pillButton" data-expand-all-gaps>Expand All Gaps</button>
          <button class="pillButton" data-reset-expanded-gaps>Reset Gaps</button>
          <button class="primaryButton" data-open-active-pair>Native Pair Diff</button>
          <button class="pillButton" data-open-active-snapshot>Active Snapshot</button>
        </div>
      </div>
      <div class="pairBar" id="pairBar"></div>
      <div class="surface" id="surface">
        <div class="gridShell" id="gridShell">
          <div class="headerRow" id="headerRow"></div>
          <div class="rowsViewport">
            <div class="topSpacer" id="topSpacer"></div>
            <div id="rowsHost"></div>
            <div class="bottomSpacer" id="bottomSpacer"></div>
          </div>
        </div>
      </div>
    </div>
    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();
      const surface = document.getElementById('surface');
      const meta = document.getElementById('meta');
      const pairBar = document.getElementById('pairBar');
      const headerRow = document.getElementById('headerRow');
      const rowsHost = document.getElementById('rowsHost');
      const topSpacer = document.getElementById('topSpacer');
      const bottomSpacer = document.getElementById('bottomSpacer');
      const gridShell = document.getElementById('gridShell');
      const runtime = {
        rowHeight: 36,
        headerHeight: 36,
        overscan: 24,
        layoutVersion: 0,
        scrollTop: 0,
        scrollLeft: 0,
        anchorRowNumber: undefined,
        anchorRowOffset: 0,
        renderVersion: 0,
        renderedLayoutVersion: -1,
        renderedVersion: -1,
        renderedRangeStart: -1,
        renderedRangeEnd: -1,
        viewModel: undefined
      };
      let scrollRestoreScheduled = false;
      let hasPendingInitialScrollRestore = false;
      const previousState = vscode.getState();
      if (previousState) {
        if (typeof previousState.scrollTop === 'number') {
          runtime.scrollTop = previousState.scrollTop;
          hasPendingInitialScrollRestore = true;
        }
        if (typeof previousState.scrollLeft === 'number') {
          runtime.scrollLeft = previousState.scrollLeft;
          hasPendingInitialScrollRestore = true;
        }
        if (typeof previousState.anchorRowNumber === 'number') {
          runtime.anchorRowNumber = previousState.anchorRowNumber;
          hasPendingInitialScrollRestore = true;
        }
        if (typeof previousState.anchorRowOffset === 'number') {
          runtime.anchorRowOffset = previousState.anchorRowOffset;
        }
      }
      headerRow.addEventListener('click', (event) => {
        const target = getActionTarget(event, '[data-focus-revision], [data-open-snapshot]');
        if (!target) {
          return;
        }
        if (target.hasAttribute('data-focus-revision')) {
          vscode.postMessage({ type: 'focusRevision', revisionIndex: Number(target.getAttribute('data-focus-revision')) });
          return;
        }
        if (target.hasAttribute('data-open-snapshot')) {
          vscode.postMessage({ type: 'openSnapshot', revisionIndex: Number(target.getAttribute('data-open-snapshot')) });
        }
      });
      pairBar.addEventListener('click', (event) => {
        const target = getActionTarget(event, '[data-focus-pair]');
        if (!target) {
          return;
        }
        vscode.postMessage({ type: 'focusPair', pairKey: String(target.getAttribute('data-focus-pair')) });
      });
      rowsHost.addEventListener('click', (event) => {
        const target = getActionTarget(event, '[data-expand-gap]');
        if (!target) {
          return;
        }
        vscode.postMessage({ type: 'expandGap', gapKey: String(target.getAttribute('data-expand-gap')) });
      });
      const switchSurfaceButton = document.querySelector('[data-switch-surface]');
      if (switchSurfaceButton) {
        switchSurfaceButton.addEventListener('click', () => {
          vscode.postMessage({ type: 'switchCompareSurface' });
        });
      }
      const changePairProjectionButton = document.querySelector('[data-change-pair-projection]');
      if (changePairProjectionButton) {
        changePairProjectionButton.addEventListener('click', () => {
          vscode.postMessage({ type: 'changePairProjection' });
        });
      }
      const collapseButton = document.querySelector('[data-toggle-collapse]');
      if (collapseButton) {
        collapseButton.addEventListener('click', () => {
          vscode.postMessage({ type: 'toggleCollapseUnchanged' });
        });
      }
      const expandAllGapsButton = document.querySelector('[data-expand-all-gaps]');
      if (expandAllGapsButton) {
        expandAllGapsButton.addEventListener('click', () => {
          vscode.postMessage({ type: 'expandAllCollapsedGaps' });
        });
      }
      const resetExpandedGapsButton = document.querySelector('[data-reset-expanded-gaps]');
      if (resetExpandedGapsButton) {
        resetExpandedGapsButton.addEventListener('click', () => {
          vscode.postMessage({ type: 'resetExpandedGaps' });
        });
      }
      const activeSnapshotButton = document.querySelector('[data-open-active-snapshot]');
      if (activeSnapshotButton) {
        activeSnapshotButton.addEventListener('click', () => {
          vscode.postMessage({ type: 'openActiveSnapshot' });
        });
      }
      const activePairButton = document.querySelector('[data-open-active-pair]');
      if (activePairButton) {
        activePairButton.addEventListener('click', () => {
          vscode.postMessage({ type: 'openActivePairDiff' });
        });
      }
      if (surface) {
        surface.addEventListener('scroll', () => {
          captureCurrentScrollPosition();
          renderRows();
          syncScrollState();
        });
      }
      window.addEventListener('resize', () => {
        scheduleScrollRestore();
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          scheduleScrollRestore();
        }
      });
      window.addEventListener('message', (event) => {
        const message = event.data;
        if (!message || message.type !== 'render') {
          return;
        }

        runtime.viewModel = message.viewModel;
        renderAll();
      });
      vscode.postMessage({ type: 'ready' });

      function renderAll() {
        if (!runtime.viewModel) {
          return;
        }

        if (!hasPendingInitialScrollRestore) {
          captureCurrentScrollPosition();
        }
        runtime.renderVersion += 1;
        applyGridColumns(runtime.viewModel.columns.length);
        renderMeta();
        renderHeader();
        renderPairs();
        updateLayoutMetrics();
        renderRows(true);
        scheduleScrollRestore();
      }

      function applyGridColumns(columnCount) {
        const columns = Array.from({ length: columnCount }, () => 'minmax(var(--cell-width), 1fr)').join(' ');
        gridShell.style.setProperty('--grid-template-columns', 'var(--gutter-width) ' + columns);
      }

      function renderMeta() {
        const viewModel = runtime.viewModel;
        const rowCountLabel = viewModel.rows.length === viewModel.totalRowCount
          ? viewModel.totalRowCount + ' rows'
          : viewModel.rows.length + ' visible / ' + viewModel.totalRowCount + ' total rows';
        const badges = [
          '<span class="metaPath">' + escapeHtml(viewModel.relativePath) + '</span>',
          '<span class="metaBadge">' + escapeHtml(viewModel.pairProjectionLabel) + '</span>',
          '<span class="metaBadge">' + viewModel.columns.length + ' revisions</span>',
          '<span class="metaBadge">' + rowCountLabel + '</span>'
        ];
        if (viewModel.activeRevisionLabel) {
          badges.push('<span class="metaBadge">active revision: ' + escapeHtml(viewModel.activeRevisionLabel) + '</span>');
        }
        if (viewModel.activePairLabel) {
          badges.push('<span class="metaBadge">active pair: ' + escapeHtml(viewModel.activePairLabel) + '</span>');
        }
        if (viewModel.hiddenRowCount > 0) {
          badges.push('<span class="metaBadge">hidden rows: ' + viewModel.hiddenRowCount + '</span>');
        }
        if (viewModel.collapseUnchanged && viewModel.collapsedGapCount > 0) {
          badges.push('<span class="metaBadge">collapsed gaps: ' + viewModel.collapsedGapCount + '</span>');
        }
        if (viewModel.expandedGapCount > 0) {
          badges.push('<span class="metaBadge">expanded gaps: ' + viewModel.expandedGapCount + '</span>');
        }
        meta.innerHTML = badges.join('');
        if (collapseButton) {
          collapseButton.classList.toggle('pillButton--active', Boolean(viewModel.collapseUnchanged));
        }
        if (changePairProjectionButton) {
          changePairProjectionButton.toggleAttribute('disabled', !viewModel.canChangePairProjection);
        }
        if (expandAllGapsButton) {
          expandAllGapsButton.toggleAttribute('disabled', !viewModel.collapseUnchanged || viewModel.collapsedGapCount === 0);
        }
        if (resetExpandedGapsButton) {
          resetExpandedGapsButton.toggleAttribute('disabled', !viewModel.collapseUnchanged || viewModel.expandedGapCount === 0);
        }
        if (activeSnapshotButton) {
          activeSnapshotButton.toggleAttribute('disabled', !viewModel.hasActiveSnapshot);
        }
        if (activePairButton) {
          activePairButton.toggleAttribute('disabled', !viewModel.hasActivePair);
        }
      }

      function renderHeader() {
        const viewModel = runtime.viewModel;
        headerRow.innerHTML = [
          '<div class="headerCell headerCell--corner">#</div>',
          ...viewModel.columns.map((column) => (
            '<div class="headerCell ' + (column.isActive ? 'headerCell--active' : '') + '">' +
              '<button class="ghostButton" data-focus-revision="' + column.revisionIndex + '">' + escapeHtml(column.revisionLabel) + '</button>' +
              '<button class="pillButton" data-open-snapshot="' + column.revisionIndex + '">Snapshot</button>' +
            '</div>'
          ))
        ].join('');
      }

      function renderPairs() {
        const viewModel = runtime.viewModel;
        pairBar.innerHTML = viewModel.pairs.map((pair) => (
          '<button class="pairButton ' + (pair.isActive ? 'pairButton--active' : '') + '" data-focus-pair="' + pair.key + '">' +
            escapeHtml(pair.label) +
          '</button>'
        )).join('');
      }

      function renderRows(forceRender = false) {
        const viewModel = runtime.viewModel;
        if (!viewModel || !surface) {
          return;
        }

        const relativeScrollTop = Math.max(0, runtime.scrollTop - runtime.headerHeight);
        const viewportHeight = Math.max(0, surface.clientHeight - runtime.headerHeight);
        const firstVisibleRow = Math.max(0, Math.floor(relativeScrollTop / runtime.rowHeight) - runtime.overscan);
        const visibleRowCount = Math.ceil(viewportHeight / runtime.rowHeight) + runtime.overscan * 2;
        const lastVisibleRow = Math.min(viewModel.rows.length, firstVisibleRow + Math.max(visibleRowCount, runtime.overscan * 2));

        if (
          !forceRender
          && runtime.renderedVersion === runtime.renderVersion
          && runtime.renderedLayoutVersion === runtime.layoutVersion
          && runtime.renderedRangeStart === firstVisibleRow
          && runtime.renderedRangeEnd === lastVisibleRow
        ) {
          return;
        }

        topSpacer.style.height = (firstVisibleRow * runtime.rowHeight) + 'px';
        bottomSpacer.style.height = Math.max(0, (viewModel.rows.length - lastVisibleRow) * runtime.rowHeight) + 'px';
        rowsHost.innerHTML = viewModel.rows.slice(firstVisibleRow, lastVisibleRow).map(renderRow).join('');
        runtime.renderedLayoutVersion = runtime.layoutVersion;
        runtime.renderedVersion = runtime.renderVersion;
        runtime.renderedRangeStart = firstVisibleRow;
        runtime.renderedRangeEnd = lastVisibleRow;
      }

      function syncScrollState() {
        vscode.setState({
          scrollTop: runtime.scrollTop,
          scrollLeft: runtime.scrollLeft,
          anchorRowNumber: runtime.anchorRowNumber,
          anchorRowOffset: runtime.anchorRowOffset
        });
      }

      function captureCurrentScrollPosition() {
        if (!surface) {
          return;
        }

        runtime.scrollTop = surface.scrollTop;
        runtime.scrollLeft = surface.scrollLeft;
        captureViewportAnchor();
      }

      function captureViewportAnchor() {
        if (!runtime.viewModel || runtime.viewModel.rows.length === 0 || !surface) {
          runtime.anchorRowNumber = undefined;
          runtime.anchorRowOffset = 0;
          return;
        }

        const relativeScrollTop = Math.max(0, surface.scrollTop - runtime.headerHeight);
        const anchorRowIndex = Math.max(0, Math.min(
          runtime.viewModel.rows.length - 1,
          Math.floor(relativeScrollTop / runtime.rowHeight)
        ));
        const anchorRow = runtime.viewModel.rows[anchorRowIndex];
        runtime.anchorRowNumber = anchorRow.kind === 'data'
          ? anchorRow.rowNumber
          : anchorRow.startRowNumber;
        runtime.anchorRowOffset = Math.max(0, relativeScrollTop - anchorRowIndex * runtime.rowHeight);
      }

      function updateLayoutMetrics() {
        const rootStyle = getComputedStyle(document.documentElement);
        const configuredRowHeight = Number.parseFloat(rootStyle.getPropertyValue('--row-height'));
        const configuredHeaderHeight = Number.parseFloat(rootStyle.getPropertyValue('--header-height'));
        const nextRowHeight = Number.isFinite(configuredRowHeight) && configuredRowHeight > 0
          ? configuredRowHeight
          : runtime.rowHeight;
        let nextHeaderHeight = Number.isFinite(configuredHeaderHeight) && configuredHeaderHeight > 0
          ? configuredHeaderHeight
          : runtime.headerHeight;
        const measuredHeaderHeight = headerRow.getBoundingClientRect().height;
        if (Number.isFinite(measuredHeaderHeight) && measuredHeaderHeight > 0) {
          nextHeaderHeight = measuredHeaderHeight;
        }

        if (nextRowHeight !== runtime.rowHeight || nextHeaderHeight !== runtime.headerHeight) {
          runtime.layoutVersion += 1;
          runtime.rowHeight = nextRowHeight;
          runtime.headerHeight = nextHeaderHeight;
        }
      }

      function getActionTarget(event, selector) {
        const target = event.target;
        return target instanceof Element ? target.closest(selector) : null;
      }

      function restoreScrollPosition() {
        if (!surface) {
          return;
        }

        updateLayoutMetrics();
        surface.scrollTop = getAnchoredScrollTop();
        surface.scrollLeft = runtime.scrollLeft;
        runtime.scrollTop = surface.scrollTop;
        runtime.scrollLeft = surface.scrollLeft;
        captureViewportAnchor();
        renderRows();
        hasPendingInitialScrollRestore = false;
        syncScrollState();
      }

      function getAnchoredScrollTop() {
        if (!surface || !runtime.viewModel) {
          return runtime.scrollTop;
        }

        const anchorRowIndex = findAnchorRowIndex(runtime.anchorRowNumber);
        if (anchorRowIndex < 0) {
          return runtime.scrollTop;
        }

        const anchoredScrollTop = runtime.headerHeight + anchorRowIndex * runtime.rowHeight + runtime.anchorRowOffset;
        const maxScrollTop = Math.max(0, surface.scrollHeight - surface.clientHeight);
        return Math.max(0, Math.min(anchoredScrollTop, maxScrollTop));
      }

      function findAnchorRowIndex(anchorRowNumber) {
        if (!runtime.viewModel || typeof anchorRowNumber !== 'number') {
          return -1;
        }

        return runtime.viewModel.rows.findIndex((row) => (
          row.kind === 'data'
            ? row.rowNumber === anchorRowNumber
            : row.startRowNumber <= anchorRowNumber && row.endRowNumber >= anchorRowNumber
        ));
      }

      function scheduleScrollRestore() {
        if (!surface || scrollRestoreScheduled) {
          return;
        }

        scrollRestoreScheduled = true;
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            scrollRestoreScheduled = false;
            restoreScrollPosition();
          });
        });
      }

      function renderRow(row) {
        if (row.kind === 'gap') {
          return '<div class="' + row.classNames.join(' ') + ' compareRow">' +
            '<div class="rowNumber">...</div>' +
            '<div class="gapCell" style="grid-column: span ' + runtime.viewModel.columns.length + '">' +
              '<button class="pillButton" data-expand-gap="' + row.gapKey + '">Show</button>' +
              '<span class="gapLabel">' + escapeHtml(row.label) + '</span>' +
            '</div>' +
          '</div>';
        }

        return '<div class="' + row.classNames.join(' ') + ' compareRow">' +
          '<div class="rowNumber">' + row.rowNumber + '</div>' +
          row.cells.map((cell) => (
            '<div class="' + cell.classNames.join(' ') + '">' + cell.html + '</div>'
          )).join('') +
        '</div>';
      }

      function escapeHtml(value) {
        return String(value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      }
    </script>
  </body>
</html>`;
}

function createNonce(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let index = 0; index < 24; index += 1) {
    nonce += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return nonce;
}

function describeTarget(target: unknown): string {
  if (typeof target === 'string') {
    return target;
  }

  if (target && typeof target === 'object') {
    return JSON.stringify(target);
  }

  return String(target);
}
