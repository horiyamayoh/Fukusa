import * as vscode from 'vscode';

import {
  AdjacentPairOverlay,
  NWayCompareSession,
  RawSnapshot,
  SessionFileBinding,
  VisibleRevisionWindow
} from '../adapters/common/types';

export const MAX_VISIBLE_REVISIONS = 9;

function normalizedPathKey(uri: vscode.Uri): string {
  return uri.toString(true);
}

export class SessionService {
  private readonly sessions = new Map<string, NWayCompareSession>();
  private readonly onDidChangeSessionsEmitter = new vscode.EventEmitter<void>();
  private readonly snapshotBindings = new Map<string, SessionFileBinding>();
  private activeSessionId: string | undefined;
  private readonly maxSessions: number;

  public readonly onDidChangeSessions = this.onDidChangeSessionsEmitter.event;

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
    if (!this.sessions.has(id)) {
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

    for (const snapshot of session.rawSnapshots) {
      this.snapshotBindings.delete(normalizedPathKey(snapshot.rawUri));
    }

    this.sessions.delete(id);
    if (this.activeSessionId === id) {
      this.activeSessionId = [...this.sessions.keys()][0];
    }
    this.onDidChangeSessionsEmitter.fire();
  }

  public updateFocusFromUri(uri: vscode.Uri): void {
    const binding = this.snapshotBindings.get(normalizedPathKey(uri));
    if (!binding) {
      return;
    }

    this.setActiveRevision(binding.sessionId, binding.revisionIndex);
  }

  public getSessionFileBinding(uri: vscode.Uri): SessionFileBinding | undefined {
    return this.snapshotBindings.get(normalizedPathKey(uri));
  }

  public getActivePair(session: NWayCompareSession): AdjacentPairOverlay | undefined {
    const selectedKey = session.activePairKey;
    if (selectedKey) {
      const selected = session.adjacentPairs.find((pair) => pair.key === selectedKey);
      if (selected) {
        return selected;
      }
    }

    const derivedPairKey = derivePairKey(session, session.activeRevisionIndex, this.getVisibleWindow(session));
    return derivedPairKey ? session.adjacentPairs.find((pair) => pair.key === derivedPairKey) : undefined;
  }

  public getActiveSnapshot(session: NWayCompareSession): RawSnapshot | undefined {
    const maxIndex = session.rawSnapshots.length - 1;
    const safeIndex = Math.max(0, Math.min(session.activeRevisionIndex, maxIndex));
    return session.rawSnapshots[safeIndex];
  }

  public getVisibleWindow(session: NWayCompareSession, pageSize = MAX_VISIBLE_REVISIONS): VisibleRevisionWindow {
    const safePageSize = Math.max(1, pageSize);
    const maxStart = Math.max(0, session.rawSnapshots.length - safePageSize);
    const startRevisionIndex = Math.max(0, Math.min(session.pageStart, maxStart));
    const rawSnapshots = session.rawSnapshots.slice(startRevisionIndex, startRevisionIndex + safePageSize);
    const endRevisionIndex = rawSnapshots.length === 0
      ? startRevisionIndex - 1
      : startRevisionIndex + rawSnapshots.length - 1;

    return {
      startRevisionIndex,
      endRevisionIndex,
      rawSnapshots
    };
  }

  public setActivePair(sessionId: string, pairKey: string): AdjacentPairOverlay | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return undefined;
    }

    const pair = session.adjacentPairs.find((entry) => entry.key === pairKey);
    if (!pair) {
      return undefined;
    }

    session.activePairKey = pair.key;
    this.activeSessionId = sessionId;
    this.onDidChangeSessionsEmitter.fire();
    return pair;
  }

  public setActiveRevision(sessionId: string, revisionIndex: number): RawSnapshot | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return undefined;
    }

    const maxIndex = Math.max(0, session.rawSnapshots.length - 1);
    const activeRevisionIndex = Math.max(0, Math.min(revisionIndex, maxIndex));
    session.activeRevisionIndex = activeRevisionIndex;
    session.activePairKey = derivePairKey(session, activeRevisionIndex, this.getVisibleWindow(session));
    this.activeSessionId = sessionId;
    this.onDidChangeSessionsEmitter.fire();
    return session.rawSnapshots[activeRevisionIndex];
  }

  public shiftWindow(sessionId: string, delta: number, pageSize = MAX_VISIBLE_REVISIONS): NWayCompareSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return undefined;
    }

    const safePageSize = Math.max(1, pageSize);
    const maxStart = Math.max(0, session.rawSnapshots.length - safePageSize);
    const nextPageStart = Math.max(0, Math.min(session.pageStart + delta, maxStart));
    if (nextPageStart === session.pageStart) {
      return session;
    }

    session.pageStart = nextPageStart;
    const visibleWindow = this.getVisibleWindow(session, safePageSize);
    if (
      session.activeRevisionIndex < visibleWindow.startRevisionIndex
      || session.activeRevisionIndex > visibleWindow.endRevisionIndex
    ) {
      session.activeRevisionIndex = visibleWindow.startRevisionIndex;
    }
    session.activePairKey = derivePairKey(session, session.activeRevisionIndex, visibleWindow);
    this.activeSessionId = sessionId;
    this.onDidChangeSessionsEmitter.fire();
    return session;
  }

  private indexSessionSnapshots(session: NWayCompareSession): void {
    for (const snapshot of session.rawSnapshots) {
      this.snapshotBindings.set(normalizedPathKey(snapshot.rawUri), {
        sessionId: session.id,
        revisionIndex: snapshot.revisionIndex,
        revisionId: snapshot.revisionId,
        relativePath: snapshot.relativePath,
        rawUri: snapshot.rawUri
      });
    }
  }
}

function derivePairKey(
  session: NWayCompareSession,
  activeRevisionIndex: number,
  visibleWindow: VisibleRevisionWindow
): string | undefined {
  if (session.adjacentPairs.length === 0) {
    return undefined;
  }

  const rightPair = `${activeRevisionIndex}:${activeRevisionIndex + 1}`;
  if (activeRevisionIndex < visibleWindow.endRevisionIndex && session.adjacentPairs.some((pair) => pair.key === rightPair)) {
    return rightPair;
  }

  const leftPair = `${activeRevisionIndex - 1}:${activeRevisionIndex}`;
  if (activeRevisionIndex > visibleWindow.startRevisionIndex && session.adjacentPairs.some((pair) => pair.key === leftPair)) {
    return leftPair;
  }

  return session.adjacentPairs.find((pair) => (
    pair.leftRevisionIndex >= visibleWindow.startRevisionIndex
    && pair.rightRevisionIndex <= visibleWindow.endRevisionIndex
  ))?.key;
}
