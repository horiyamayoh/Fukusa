import * as vscode from 'vscode';

import { SessionFileBinding, NWayCompareSession } from '../../adapters/common/types';
import { MAX_VISIBLE_REVISIONS, SessionService } from '../../application/sessionService';
import { buildSessionViewport, getSessionVisibleWindow } from '../../application/sessionViewport';
import { UriFactory } from '../../infrastructure/fs/uriFactory';
import { OutputLogger } from '../../util/output';
import { DiffDecorationController } from './diffDecorationController';
import { EditorLayoutController } from './editorLayoutController';
import { EditorSyncController } from './editorSyncController';

interface SessionTabState {
  readonly renderGeneration: number;
  readonly trackedUriKeys: ReadonlySet<string>;
}

interface RenderSessionOptions {
  readonly existingTabsAlreadyClosed?: boolean;
  readonly restoreTopGlobalRow?: number;
}

export class NativeCompareSessionController implements vscode.Disposable {
  private nextRenderGeneration = 0;
  private decorationRefreshScheduled = false;
  private readonly sessionTabs = new Map<string, SessionTabState>();
  private readonly trackedUriOwners = new Map<string, string>();
  private readonly internalCloseKeys = new Set<string>();
  private readonly cascadingSessions = new Set<string>();
  private readonly disposables: vscode.Disposable[] = [];

  public constructor(
    private readonly sessionService: SessionService,
    private readonly uriFactory: UriFactory,
    private readonly editorLayoutController: EditorLayoutController,
    private readonly diffDecorationController: DiffDecorationController,
    private readonly editorSyncController: EditorSyncController,
    private readonly output: OutputLogger
  ) {
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (!editor) {
          return;
        }

        if (!this.sessionService.getSessionFileBinding(editor.document.uri)) {
          return;
        }

        this.sessionService.updateFocusFromUri(editor.document.uri);
      }),
      vscode.window.tabGroups.onDidChangeTabs((event) => {
        void this.handleTabChanges(event);
      }),
      this.sessionService.onDidChangeSessions(() => {
        this.handleSessionsChange();
      }),
      this.sessionService.onDidChangeSessionViewState((sessionId) => {
        void this.handleSessionViewStateChange(sessionId);
      }),
      this.sessionService.onDidChangeSessionProjection((sessionId) => {
        void this.handleSessionProjectionChange(sessionId);
      })
    );
  }

  public async openSession(session: NWayCompareSession): Promise<void> {
    this.sessionService.setActiveBrowserSession(session.id);
    await this.renderSession(session);
  }

  public async revealSession(sessionId: string): Promise<void> {
    const session = this.sessionService.getBrowserSession(sessionId);
    if (!session) {
      void vscode.window.showInformationMessage('The requested Fukusa session no longer exists.');
      return;
    }

    this.sessionService.setActiveBrowserSession(session.id);
    const activeRevisionIndex = this.sessionService.getSessionViewState(session.id).activeRevisionIndex;
    const binding = this.sessionService.getVisibleWindowBinding(session.id, activeRevisionIndex)
      ?? this.sessionService.getVisibleWindowBindings(session.id)[0];
    if (!binding) {
      await this.openSession(session);
      return;
    }

    const document = await vscode.workspace.openTextDocument(binding.documentUri);
    await vscode.window.showTextDocument(document, {
      preview: false,
      preserveFocus: false,
      viewColumn: vscode.ViewColumn.Active
    });
  }

  public async shiftWindow(delta: number): Promise<void> {
    const session = this.sessionService.getActiveBrowserSession();
    if (!session) {
      void vscode.window.showInformationMessage('No active Fukusa session.');
      return;
    }

    await this.shiftSessionWindow(session.id, delta);
  }

  public async shiftSessionWindow(sessionId: string, delta: number): Promise<boolean> {
    const session = this.sessionService.getBrowserSession(sessionId);
    if (!session || session.surfaceMode !== 'native') {
      return false;
    }

    const viewState = this.sessionService.getSessionViewState(session.id);
    const maxStart = Math.max(0, session.rawSnapshots.length - MAX_VISIBLE_REVISIONS);
    const nextPageStart = Math.max(0, Math.min(viewState.pageStart + delta, maxStart));
    if (nextPageStart === viewState.pageStart) {
      return false;
    }

    const restoreTopGlobalRow = this.captureTopVisibleGlobalRow(session.id);
    const closed = await this.closeTrackedTabs(session.id);
    if (!closed) {
      this.output.warn(`Cancelled window shift for session ${session.id} because the existing tabs could not be closed.`);
      return false;
    }

    this.unregisterSessionTabs(session.id);
    const shifted = this.sessionService.shiftWindow(session.id, delta, MAX_VISIBLE_REVISIONS);
    if (!shifted) {
      return false;
    }

    await this.renderSession(shifted, {
      existingTabsAlreadyClosed: true,
      restoreTopGlobalRow
    });
    return true;
  }

  public async closeActiveSession(): Promise<void> {
    const session = this.sessionService.getActiveBrowserSession();
    if (!session) {
      void vscode.window.showInformationMessage('No active Fukusa session.');
      return;
    }

    const closed = await this.closeSessionSurface(session.id);
    if (!closed) {
      this.output.warn(`Cancelled close for session ${session.id} because one or more tabs remained open.`);
      return;
    }

    this.sessionService.removeSession(session.id);
  }

  public async closeSessionSurface(sessionId: string): Promise<boolean> {
    const closed = await this.closeTrackedTabs(sessionId);
    if (!closed) {
      return false;
    }

    this.unregisterSessionTabs(sessionId);
    if (this.sessionService.getActiveBrowserSession()?.id === sessionId) {
      this.editorSyncController.clear();
      this.diffDecorationController.refresh();
    }
    return true;
  }

  public dispose(): void {
    while (this.disposables.length > 0) {
      this.disposables.pop()?.dispose();
    }
  }

  private async renderSession(session: NWayCompareSession, options: RenderSessionOptions = {}): Promise<void> {
    const existingTabsAlreadyClosed = options.existingTabsAlreadyClosed ?? false;
    const restoreTopGlobalRow = options.restoreTopGlobalRow
      ?? (!existingTabsAlreadyClosed ? this.captureTopVisibleGlobalRow(session.id) : undefined);

    if (!existingTabsAlreadyClosed) {
      const closed = await this.closeTrackedTabs(session.id);
      if (!closed) {
        this.output.warn(`Cancelled render for session ${session.id} because the existing tabs could not be closed.`);
        return;
      }

      this.unregisterSessionTabs(session.id);
    }

    let viewState = this.sessionService.getSessionViewState(session.id);
    const visibleWindow = getSessionVisibleWindow(session, viewState, MAX_VISIBLE_REVISIONS);
    if (visibleWindow.rawSnapshots.length === 0) {
      return;
    }

    if (
      viewState.activeRevisionIndex < visibleWindow.startRevisionIndex
      || viewState.activeRevisionIndex > visibleWindow.endRevisionIndex
    ) {
      this.sessionService.setActiveRevision(session.id, visibleWindow.startRevisionIndex);
      viewState = this.sessionService.getSessionViewState(session.id);
    }

    const activeRevisionIndex = this.sessionService.getActiveSnapshot(session)?.revisionIndex ?? visibleWindow.startRevisionIndex;
    const renderGeneration = ++this.nextRenderGeneration;
    const rowProjectionState = this.sessionService.getRowProjectionState(session.id);
    const viewport = buildSessionViewport(session, viewState, rowProjectionState, MAX_VISIBLE_REVISIONS);
    const compareBindings = visibleWindow.rawSnapshots.map((snapshot) => (
      this.toCompareBinding(
        session,
        visibleWindow.startRevisionIndex,
        snapshot.revisionIndex,
        viewport.documentGlobalRowNumbers,
        viewport.documentLineMap
      )
    ));

    await this.editorLayoutController.setLayout(visibleWindow.rawSnapshots.length);
    this.sessionService.replaceVisibleWindowBindings(session.id, compareBindings);

    const openedDocumentUris: vscode.Uri[] = [];
    for (const [index, binding] of compareBindings.entries()) {
      const document = await vscode.workspace.openTextDocument(binding.documentUri);
      openedDocumentUris.push(document.uri);
      await vscode.window.showTextDocument(document, {
        viewColumn: toViewColumn(index),
        preview: false,
        preserveFocus: binding.revisionIndex !== activeRevisionIndex
      });
    }

    // If VS Code normalized any URIs, register additional bindings under the canonical URIs
    // so that tab tracking and scroll sync can find them.
    const additionalBindings: SessionFileBinding[] = [];
    for (const [index, binding] of compareBindings.entries()) {
      const actualUriKey = openedDocumentUris[index].toString(true);
      const bindingUriKey = binding.documentUri.toString(true);
      if (actualUriKey !== bindingUriKey) {
        additionalBindings.push({ ...binding, documentUri: openedDocumentUris[index] });
      }
    }
    if (additionalBindings.length > 0) {
      this.sessionService.replaceVisibleWindowBindings(session.id, [...compareBindings, ...additionalBindings]);
    }

    this.trackSessionTabs(session.id, openedDocumentUris, renderGeneration);
    this.editorSyncController.setSession(session, visibleWindow, renderGeneration);
    if (restoreTopGlobalRow !== undefined) {
      this.editorSyncController.restoreTopGlobalRow(session.id, restoreTopGlobalRow, renderGeneration, visibleWindow.startRevisionIndex);
    }
    this.diffDecorationController.refresh();
    this.output.info(`Opened native compare session ${session.id} with ${visibleWindow.rawSnapshots.length} revisions.`);
  }

  private handleSessionsChange(): void {
    const session = this.sessionService.getActiveBrowserSession();
    if (!session || session.surfaceMode !== 'native') {
      this.editorSyncController.clear();
      this.diffDecorationController.refresh();
      return;
    }

    const renderGeneration = this.sessionTabs.get(session.id)?.renderGeneration ?? 0;
    this.editorSyncController.setSession(session, this.sessionService.getVisibleWindow(session), renderGeneration);
    this.diffDecorationController.refresh();
  }

  private async handleSessionViewStateChange(sessionId: string): Promise<void> {
    if (!this.sessionTabs.has(sessionId)) {
      return;
    }

    const session = this.sessionService.getBrowserSession(sessionId);
    if (!session || session.surfaceMode !== 'native' || this.sessionService.getActiveBrowserSession()?.id !== sessionId) {
      return;
    }

    const trackedWindowStart = this.getTrackedWindowStart(sessionId);
    const visibleWindow = this.sessionService.getVisibleWindow(session, MAX_VISIBLE_REVISIONS);
    if (trackedWindowStart !== undefined && trackedWindowStart !== visibleWindow.startRevisionIndex) {
      await this.renderSession(session);
      return;
    }

    this.refreshDecorations();
  }

  private refreshDecorations(): void {
    if (this.decorationRefreshScheduled) {
      return;
    }

    this.decorationRefreshScheduled = true;
    queueMicrotask(() => {
      this.decorationRefreshScheduled = false;
      this.diffDecorationController.refresh();
    });
  }

  private async handleSessionProjectionChange(sessionId: string): Promise<void> {
    if (!this.sessionTabs.has(sessionId)) {
      return;
    }

    const session = this.sessionService.getBrowserSession(sessionId);
    if (!session || session.surfaceMode !== 'native') {
      return;
    }

    await this.renderSession(session);
  }

  private async handleTabChanges(event: vscode.TabChangeEvent): Promise<void> {
    const affectedSessionIds = new Set<string>();
    for (const tab of event.closed) {
      const uri = getTabUri(tab);
      if (!uri) {
        continue;
      }

      const uriKey = uri.toString(true);
      const sessionId = this.trackedUriOwners.get(uriKey);
      if (!sessionId) {
        continue;
      }

      const internalCloseKey = toInternalCloseKey(sessionId, uriKey);
      if (this.internalCloseKeys.delete(internalCloseKey)) {
        continue;
      }

      affectedSessionIds.add(sessionId);
    }

    await Promise.all([...affectedSessionIds].map(async (sessionId) => {
      if (this.cascadingSessions.has(sessionId)) {
        return;
      }

      this.cascadingSessions.add(sessionId);
      try {
        await this.closeSessionAfterUserTabClose(sessionId);
      } finally {
        this.cascadingSessions.delete(sessionId);
      }
    }));
  }

  private async closeSessionAfterUserTabClose(sessionId: string): Promise<void> {
    const session = this.sessionService.getSession(sessionId);
    if (!session) {
      this.unregisterSessionTabs(sessionId);
      return;
    }

    const closed = await this.closeTrackedTabs(sessionId);
    this.unregisterSessionTabs(sessionId);
    this.sessionService.removeSession(sessionId);

    if (!closed) {
      this.output.warn(`Partially closed session ${sessionId}; some tabs remained open after the user closed one session tab.`);
    }
  }

  private async closeTrackedTabs(sessionId: string): Promise<boolean> {
    const tabs = this.findTrackedTabs(sessionId);
    if (tabs.length === 0) {
      return true;
    }

    const closeKeys = tabs
      .map((tab) => getTabUri(tab)?.toString(true))
      .filter((value): value is string => value !== undefined)
      .map((uriKey) => toInternalCloseKey(sessionId, uriKey));

    for (const key of closeKeys) {
      this.internalCloseKeys.add(key);
    }

    try {
      return await vscode.window.tabGroups.close(tabs, true);
    } finally {
      for (const key of closeKeys) {
        this.internalCloseKeys.delete(key);
      }
    }
  }

  private findTrackedTabs(sessionId: string): vscode.Tab[] {
    const tracked = this.sessionTabs.get(sessionId);
    if (!tracked) {
      return [];
    }

    const tabs: vscode.Tab[] = [];
    for (const group of vscode.window.tabGroups.all) {
      for (const tab of group.tabs) {
        const uri = getTabUri(tab);
        if (!uri) {
          continue;
        }

        if (tracked.trackedUriKeys.has(uri.toString(true))) {
          tabs.push(tab);
        }
      }
    }

    return tabs;
  }

  private trackSessionTabs(sessionId: string, uris: readonly vscode.Uri[], renderGeneration: number): void {
    this.forgetSessionTabs(sessionId);

    const trackedUriKeys = new Set(uris.map((uri) => uri.toString(true)));
    this.sessionTabs.set(sessionId, {
      renderGeneration,
      trackedUriKeys
    });

    for (const uriKey of trackedUriKeys) {
      this.trackedUriOwners.set(uriKey, sessionId);
    }
  }

  private unregisterSessionTabs(sessionId: string): void {
    this.sessionService.clearVisibleWindowBindings(sessionId);
    this.forgetSessionTabs(sessionId);
  }

  private forgetSessionTabs(sessionId: string): void {
    const tracked = this.sessionTabs.get(sessionId);
    if (!tracked) {
      return;
    }

    for (const uriKey of tracked.trackedUriKeys) {
      if (this.trackedUriOwners.get(uriKey) === sessionId) {
        this.trackedUriOwners.delete(uriKey);
      }
    }

    this.sessionTabs.delete(sessionId);
  }

  private captureTopVisibleGlobalRow(sessionId: string): number | undefined {
    const editor = this.findTrackedEditor(sessionId);
    if (!editor) {
      return undefined;
    }

    const binding = this.sessionService.getSessionFileBinding(editor.document.uri);
    if (!binding || binding.sessionId !== sessionId || binding.lineNumberSpace !== 'globalRow') {
      return undefined;
    }

    const topDocumentLine = editor.visibleRanges[0]?.start.line;
    if (topDocumentLine === undefined) {
      return 1;
    }

    return binding.projectedLineMap?.documentLineToGlobalRow.get(topDocumentLine + 1) ?? topDocumentLine + 1;
  }

  private getTrackedWindowStart(sessionId: string): number | undefined {
    const editor = this.findTrackedEditor(sessionId);
    if (!editor) {
      return undefined;
    }

    return this.sessionService.getSessionFileBinding(editor.document.uri)?.windowStart;
  }

  private findTrackedEditor(sessionId: string): vscode.TextEditor | undefined {
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor && this.isTrackedEditor(sessionId, activeEditor)) {
      return activeEditor;
    }

    return vscode.window.visibleTextEditors.find((editor) => this.isTrackedEditor(sessionId, editor));
  }

  private isTrackedEditor(sessionId: string, editor: vscode.TextEditor): boolean {
    const tracked = this.sessionTabs.get(sessionId);
    if (!tracked) {
      return false;
    }

    const binding = this.sessionService.getSessionFileBinding(editor.document.uri);
    if (!binding || binding.sessionId !== sessionId || binding.lineNumberSpace !== 'globalRow') {
      return false;
    }

    return tracked.trackedUriKeys.has(editor.document.uri.toString(true));
  }

  private toCompareBinding(
    session: NWayCompareSession,
    windowStart: number,
    revisionIndex: number,
    projectedGlobalRows: readonly number[],
    projectedLineMap: SessionFileBinding['projectedLineMap']
  ): SessionFileBinding {
    const snapshot = session.rawSnapshots[revisionIndex];
    const documentUri = this.uriFactory.createSessionDocumentUri(
      session.id,
      windowStart,
      revisionIndex,
      snapshot.relativePath,
      snapshot.revisionLabel
    );

    return {
      sessionId: session.id,
      revisionIndex,
      revisionId: snapshot.revisionId,
      relativePath: snapshot.relativePath,
      rawUri: snapshot.rawUri,
      documentUri,
      lineNumberSpace: 'globalRow',
      windowStart,
      projectedGlobalRows,
      projectedLineMap
    };
  }
}

function toViewColumn(index: number): vscode.ViewColumn {
  return Math.max(1, Math.min(index + 1, MAX_VISIBLE_REVISIONS)) as vscode.ViewColumn;
}

function getTabUri(tab: vscode.Tab): vscode.Uri | undefined {
  const input = tab.input as { readonly uri?: vscode.Uri };
  if (input instanceof vscode.TabInputText) {
    return input.uri;
  }

  return input.uri;
}

function toInternalCloseKey(sessionId: string, uriKey: string): string {
  return `${sessionId}::${uriKey}`;
}
