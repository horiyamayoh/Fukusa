import * as vscode from 'vscode';

import {
  ComparePairOverlay,
  ComparePairProjection,
  CompareSurfaceMode,
  NWayCompareSession,
  RawSnapshot,
  SessionRowProjectionState,
  SessionViewState,
  SessionFileBinding,
  VisibleRevisionWindow
} from '../adapters/common/types';
import { deriveActivePairKey, getPairOverlay, normalizePairProjection } from './comparePairing';
import {
  buildSessionViewport,
  createInitialSessionViewState,
  deriveSessionSelectionViewState,
  getSessionActivePair,
  getSessionVisibleWindow,
  MAX_VISIBLE_REVISIONS
} from './sessionViewport';
export { MAX_VISIBLE_REVISIONS } from './sessionViewport';

function normalizedPathKey(uri: vscode.Uri): string {
  return uri.toString(true);
}

export class SessionService {
  private readonly sessions = new Map<string, NWayCompareSession>();
  private readonly onDidChangeSessionsEmitter = new vscode.EventEmitter<void>();
  private readonly onDidChangeSessionViewStateEmitter = new vscode.EventEmitter<string>();
  private readonly onDidChangeSessionProjectionEmitter = new vscode.EventEmitter<string>();
  private readonly onDidChangeSessionPresentationEmitter = new vscode.EventEmitter<string>();
  private readonly fileBindings = new Map<string, SessionFileBinding>();
  private readonly viewStates = new Map<string, SessionViewState>();
  private readonly rowProjectionStates = new Map<string, { collapseUnchanged: boolean; expandedGapKeys: Set<string> }>();
  private activeSessionId: string | undefined;
  private readonly maxSessions: number;

  public readonly onDidChangeSessions = this.onDidChangeSessionsEmitter.event;
  public readonly onDidChangeSessionViewState = this.onDidChangeSessionViewStateEmitter.event;
  public readonly onDidChangeSessionProjection = this.onDidChangeSessionProjectionEmitter.event;
  public readonly onDidChangeSessionPresentation = this.onDidChangeSessionPresentationEmitter.event;

  public constructor(maxSessions = 20) {
    this.maxSessions = Math.max(1, maxSessions);
  }

  public createBrowserSession(session: NWayCompareSession): NWayCompareSession {
    while (this.sessions.size >= this.maxSessions) {
      const oldest = [...this.sessions.values()].sort((left, right) => left.createdAt - right.createdAt)[0];
      if (!oldest) {
        break;
      }

      this.removeSession(oldest.id);
    }

    this.sessions.set(session.id, session);
    this.viewStates.set(session.id, createInitialSessionViewState(session));
    this.rowProjectionStates.set(session.id, {
      collapseUnchanged: false,
      expandedGapKeys: new Set<string>()
    });
    this.activeSessionId = session.id;
    this.indexSessionSnapshots(session);
    this.onDidChangeSessionsEmitter.fire();
    return session;
  }

  public listSessions(): readonly NWayCompareSession[] {
    return [...this.sessions.values()];
  }

  public getSession(id: string): NWayCompareSession | undefined {
    return this.sessions.get(id);
  }

  public getBrowserSession(id: string): NWayCompareSession | undefined {
    return this.getSession(id);
  }

  public getBrowserSessionByUri(uri: vscode.Uri): NWayCompareSession | undefined {
    for (const session of this.sessions.values()) {
      if (session.uri.toString(true) === uri.toString(true)) {
        return session;
      }
    }

    return undefined;
  }

  public getActiveBrowserSession(): NWayCompareSession | undefined {
    return this.activeSessionId ? this.sessions.get(this.activeSessionId) : undefined;
  }

  public setActiveBrowserSession(id: string): void {
    if (!this.sessions.has(id) || this.activeSessionId === id) {
      return;
    }

    this.activeSessionId = id;
    this.onDidChangeSessionsEmitter.fire();
  }

  public removeSession(id: string): void {
    const session = this.sessions.get(id);
    if (!session) {
      return;
    }

    this.removeBindings((binding) => binding.sessionId === id);
    this.viewStates.delete(id);
    this.rowProjectionStates.delete(id);

    this.sessions.delete(id);
    if (this.activeSessionId === id) {
      this.activeSessionId = [...this.sessions.keys()][0];
    }
    this.onDidChangeSessionsEmitter.fire();
  }

  public updateFocusFromUri(uri: vscode.Uri): void {
    const binding = this.fileBindings.get(normalizedPathKey(uri));
    if (!binding) {
      return;
    }

    this.setActiveRevision(binding.sessionId, binding.revisionIndex);
  }

  public getSessionFileBinding(uri: vscode.Uri): SessionFileBinding | undefined {
    return this.fileBindings.get(normalizedPathKey(uri));
  }

  public getSessionViewState(sessionId: string): SessionViewState {
    const viewState = this.viewStates.get(sessionId);
    return viewState ?? {
      activeRevisionIndex: 0,
      activePairKey: undefined,
      pageStart: 0
    };
  }

  public getVisibleWindowBindings(sessionId: string): readonly SessionFileBinding[] {
    return [...this.fileBindings.values()]
      .filter((binding) => binding.sessionId === sessionId && binding.lineNumberSpace === 'globalRow')
      .sort((left, right) => left.revisionIndex - right.revisionIndex);
  }

  public getVisibleWindowBinding(sessionId: string, revisionIndex: number): SessionFileBinding | undefined {
    return this.getVisibleWindowBindings(sessionId).find((binding) => binding.revisionIndex === revisionIndex);
  }

  public replaceVisibleWindowBindings(sessionId: string, bindings: readonly SessionFileBinding[]): void {
    this.removeBindings((binding) => binding.sessionId === sessionId && binding.lineNumberSpace === 'globalRow');
    for (const binding of bindings) {
      this.fileBindings.set(normalizedPathKey(binding.documentUri), binding);
    }
  }

  public clearVisibleWindowBindings(sessionId: string): void {
    this.removeBindings((binding) => binding.sessionId === sessionId && binding.lineNumberSpace === 'globalRow');
  }

  public getRowProjectionState(sessionId: string): SessionRowProjectionState {
    const state = this.rowProjectionStates.get(sessionId);
    return {
      collapseUnchanged: state?.collapseUnchanged ?? false,
      expandedGapKeys: [...(state?.expandedGapKeys ?? [])]
    };
  }

  public toggleCollapseUnchanged(sessionId: string): SessionRowProjectionState | undefined {
    const state = this.rowProjectionStates.get(sessionId);
    if (!state || !this.sessions.has(sessionId)) {
      return undefined;
    }

    state.collapseUnchanged = !state.collapseUnchanged;
    this.clearExpandedGapKeys(sessionId);
    this.onDidChangeSessionProjectionEmitter.fire(sessionId);
    return this.getRowProjectionState(sessionId);
  }

  public expandProjectionGap(sessionId: string, gapKey: string): SessionRowProjectionState | undefined {
    const state = this.rowProjectionStates.get(sessionId);
    const session = this.sessions.get(sessionId);
    if (!state || !session || !state.collapseUnchanged) {
      return undefined;
    }

    if (state.expandedGapKeys.has(gapKey) || !this.hasCollapsedGap(session, sessionId, gapKey, state.expandedGapKeys)) {
      return this.getRowProjectionState(sessionId);
    }

    state.expandedGapKeys.add(gapKey);
    this.onDidChangeSessionProjectionEmitter.fire(sessionId);
    return this.getRowProjectionState(sessionId);
  }

  public expandAllProjectionGaps(sessionId: string): SessionRowProjectionState | undefined {
    const state = this.rowProjectionStates.get(sessionId);
    const session = this.sessions.get(sessionId);
    if (!state || !session || !state.collapseUnchanged) {
      return undefined;
    }

    const collapsedGapKeys = this.getCollapsedGapKeys(session, sessionId, state.expandedGapKeys);
    let changed = false;
    for (const gapKey of collapsedGapKeys) {
      if (!state.expandedGapKeys.has(gapKey)) {
        state.expandedGapKeys.add(gapKey);
        changed = true;
      }
    }

    if (changed) {
      this.onDidChangeSessionProjectionEmitter.fire(sessionId);
    }

    return this.getRowProjectionState(sessionId);
  }

  public resetExpandedProjectionGaps(sessionId: string): SessionRowProjectionState | undefined {
    const state = this.rowProjectionStates.get(sessionId);
    const session = this.sessions.get(sessionId);
    if (!state || !session || !state.collapseUnchanged) {
      return undefined;
    }

    if (state.expandedGapKeys.size === 0) {
      return this.getRowProjectionState(sessionId);
    }

    state.expandedGapKeys.clear();
    this.onDidChangeSessionProjectionEmitter.fire(sessionId);
    return this.getRowProjectionState(sessionId);
  }

  public getActivePair(session: NWayCompareSession): ComparePairOverlay | undefined {
    return getSessionActivePair(session, this.getSessionViewState(session.id), this.getVisibleWindow(session));
  }

  public getActiveSnapshot(session: NWayCompareSession): RawSnapshot | undefined {
    const viewState = this.getSessionViewState(session.id);
    const maxIndex = session.rawSnapshots.length - 1;
    const safeIndex = Math.max(0, Math.min(viewState.activeRevisionIndex, maxIndex));
    return session.rawSnapshots[safeIndex];
  }

  public getVisibleWindow(session: NWayCompareSession, pageSize = MAX_VISIBLE_REVISIONS): VisibleRevisionWindow {
    return getSessionVisibleWindow(session, this.getSessionViewState(session.id), pageSize);
  }

  public updatePairProjection(sessionId: string, pairProjection: ComparePairProjection): NWayCompareSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return undefined;
    }

    const normalizedProjection = normalizePairProjection(pairProjection, session.rawSnapshots.length);
    if (pairProjectionEquals(session.pairProjection, normalizedProjection)) {
      return session;
    }

    const updatedSession: NWayCompareSession = {
      ...session,
      pairProjection: normalizedProjection
    };
    this.sessions.set(sessionId, updatedSession);
    this.clearExpandedGapKeys(sessionId);
    this.onDidChangeSessionProjectionEmitter.fire(sessionId);
    return updatedSession;
  }

  public updateSurfaceMode(sessionId: string, surfaceMode: CompareSurfaceMode): NWayCompareSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session || session.surfaceMode === surfaceMode) {
      return session;
    }

    const updatedSession: NWayCompareSession = {
      ...session,
      surfaceMode
    };
    this.sessions.set(sessionId, updatedSession);
    const viewState = this.viewStates.get(sessionId);
    if (viewState) {
      this.viewStates.set(sessionId, deriveSessionSelectionViewState(updatedSession, viewState));
    }
    this.onDidChangeSessionPresentationEmitter.fire(sessionId);
    return updatedSession;
  }

  public setActivePair(sessionId: string, pairKey: string): ComparePairOverlay | undefined {
    const session = this.sessions.get(sessionId);
    const viewState = this.viewStates.get(sessionId);
    if (!session) {
      return undefined;
    }

    const pair = getPairOverlay(session, pairKey);
    if (!pair) {
      return undefined;
    }

    const activeSessionChanged = this.activeSessionId !== sessionId;
    const nextViewState = deriveSessionSelectionViewState(session, {
      activeRevisionIndex: pair.rightRevisionIndex,
      activePairKey: pair.key,
      pageStart: viewState?.pageStart ?? 0
    });
    if (
      viewState?.activeRevisionIndex === nextViewState.activeRevisionIndex
      && viewState?.activePairKey === nextViewState.activePairKey
      && viewState?.pageStart === nextViewState.pageStart
      && !activeSessionChanged
    ) {
      return pair;
    }

    this.viewStates.set(sessionId, nextViewState);
    this.activeSessionId = sessionId;
    this.fireSessionViewStateChange(sessionId, activeSessionChanged);
    return pair;
  }

  public setActiveRevision(sessionId: string, revisionIndex: number): RawSnapshot | undefined {
    const session = this.sessions.get(sessionId);
    const viewState = this.viewStates.get(sessionId);
    if (!session) {
      return undefined;
    }

    const maxIndex = Math.max(0, session.rawSnapshots.length - 1);
    const activeRevisionIndex = Math.max(0, Math.min(revisionIndex, maxIndex));
    const nextViewState = deriveSessionSelectionViewState(session, {
      activeRevisionIndex,
      activePairKey: undefined,
      pageStart: viewState?.pageStart ?? 0
    });
    if (
      viewState?.activeRevisionIndex === nextViewState.activeRevisionIndex
      && viewState?.activePairKey === nextViewState.activePairKey
      && viewState?.pageStart === nextViewState.pageStart
      && this.activeSessionId === sessionId
    ) {
      return session.rawSnapshots[activeRevisionIndex];
    }

    this.viewStates.set(sessionId, nextViewState);
    const activeSessionChanged = this.activeSessionId !== sessionId;
    this.activeSessionId = sessionId;
    this.fireSessionViewStateChange(sessionId, activeSessionChanged);
    return session.rawSnapshots[activeRevisionIndex];
  }

  public shiftWindow(sessionId: string, delta: number, pageSize = MAX_VISIBLE_REVISIONS): NWayCompareSession | undefined {
    const session = this.sessions.get(sessionId);
    const viewState = this.viewStates.get(sessionId);
    if (!session) {
      return undefined;
    }

    if (session.surfaceMode === 'panel') {
      return session;
    }

    const safePageSize = Math.max(1, pageSize);
    const maxStart = Math.max(0, session.rawSnapshots.length - safePageSize);
    const nextPageStart = Math.max(0, Math.min((viewState?.pageStart ?? 0) + delta, maxStart));
    if (nextPageStart === (viewState?.pageStart ?? 0)) {
      return session;
    }

    const currentActiveRevisionIndex = viewState?.activeRevisionIndex ?? 0;
    const visibleWindow = getSessionVisibleWindow(session, { pageStart: nextPageStart }, safePageSize);
    const activeRevisionIndex = (
      currentActiveRevisionIndex < visibleWindow.startRevisionIndex
      || currentActiveRevisionIndex > visibleWindow.endRevisionIndex
    )
      ? visibleWindow.startRevisionIndex
      : currentActiveRevisionIndex;
    this.clearExpandedGapKeys(sessionId);
    this.viewStates.set(sessionId, {
      activeRevisionIndex,
      activePairKey: deriveActivePairKey(session, activeRevisionIndex, visibleWindow),
      pageStart: nextPageStart
    });
    const activeSessionChanged = this.activeSessionId !== sessionId;
    this.activeSessionId = sessionId;
    this.fireSessionViewStateChange(sessionId, activeSessionChanged);
    return session;
  }

  private indexSessionSnapshots(session: NWayCompareSession): void {
    for (const snapshot of session.rawSnapshots) {
      this.fileBindings.set(normalizedPathKey(snapshot.rawUri), {
        sessionId: session.id,
        revisionIndex: snapshot.revisionIndex,
        revisionId: snapshot.revisionId,
        relativePath: snapshot.relativePath,
        rawUri: snapshot.rawUri,
        documentUri: snapshot.rawUri,
        lineNumberSpace: 'original'
      });
    }
  }

  private removeBindings(predicate: (binding: SessionFileBinding) => boolean): void {
    for (const [key, binding] of this.fileBindings.entries()) {
      if (predicate(binding)) {
        this.fileBindings.delete(key);
      }
    }
  }

  private hasCollapsedGap(
    session: NWayCompareSession,
    sessionId: string,
    gapKey: string,
    expandedGapKeys: ReadonlySet<string>
  ): boolean {
    return this.getCollapsedGapKeys(session, sessionId, expandedGapKeys).includes(gapKey);
  }

  private getCollapsedGapKeys(
    session: NWayCompareSession,
    sessionId: string,
    expandedGapKeys: ReadonlySet<string>
  ): readonly string[] {
    return buildSessionViewport(session, this.getSessionViewState(sessionId), {
      collapseUnchanged: true,
      expandedGapKeys: [...expandedGapKeys]
    }).rowProjection.rows
      .flatMap((row) => row.kind === 'gap' ? [row.gapKey] : []);
  }

  private clearExpandedGapKeys(sessionId: string): boolean {
    const state = this.rowProjectionStates.get(sessionId);
    if (!state || state.expandedGapKeys.size === 0) {
      return false;
    }

    state.expandedGapKeys.clear();
    return true;
  }

  private fireSessionViewStateChange(sessionId: string, activeSessionChanged: boolean): void {
    if (activeSessionChanged) {
      this.onDidChangeSessionsEmitter.fire();
    }

    this.onDidChangeSessionViewStateEmitter.fire(sessionId);
  }
}

function pairProjectionEquals(left: ComparePairProjection, right: ComparePairProjection): boolean {
  if (left.mode !== right.mode) {
    return false;
  }

  if (left.mode !== 'custom' || right.mode !== 'custom') {
    return true;
  }

  const leftPairKeys = left.pairKeys ?? [];
  const rightPairKeys = right.pairKeys ?? [];
  return leftPairKeys.length === rightPairKeys.length
    && leftPairKeys.every((key, index) => key === rightPairKeys[index]);
}
