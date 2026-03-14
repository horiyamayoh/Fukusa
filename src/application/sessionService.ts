import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';

import { DiffPair, MultiDiffSession, RepoContext, RevisionRef, SessionMode, SnapshotResource } from '../adapters/common/types';
import { UriFactory } from '../infrastructure/fs/uriFactory';

export class SessionService {
  private readonly sessions = new Map<string, MultiDiffSession>();
  private readonly onDidChangeSessionsEmitter = new vscode.EventEmitter<void>();
  private readonly maxSessions: number;
  private activeSessionId: string | undefined;

  public readonly onDidChangeSessions = this.onDidChangeSessionsEmitter.event;

  public constructor(private readonly uriFactory: UriFactory, maxSessions = 20) {
    this.maxSessions = Math.max(1, maxSessions);
  }

  public createSession(
    repo: RepoContext,
    originalUri: vscode.Uri,
    relativePath: string,
    revisions: readonly RevisionRef[],
    mode: SessionMode,
    visiblePairCount: number
  ): MultiDiffSession {
    while (this.sessions.size >= this.maxSessions) {
      const oldest = [...this.sessions.values()].sort((left, right) => left.createdAt - right.createdAt)[0];
      if (!oldest) {
        break;
      }

      this.removeSession(oldest.id);
    }

    const pairs = this.buildPairs(repo, relativePath, revisions, mode);
    const session: MultiDiffSession = {
      id: uuidv4(),
      repo,
      originalUri,
      relativePath,
      revisions,
      pairs,
      mode,
      createdAt: Date.now(),
      visiblePairCount,
      visibleStartPairIndex: 0
    };
    this.sessions.set(session.id, session);
    this.activeSessionId = session.id;
    this.onDidChangeSessionsEmitter.fire();
    return session;
  }

  public listSessions(): readonly MultiDiffSession[] {
    return [...this.sessions.values()];
  }

  public getSession(id: string): MultiDiffSession | undefined {
    return this.sessions.get(id);
  }

  public getActiveSession(): MultiDiffSession | undefined {
    return this.activeSessionId ? this.sessions.get(this.activeSessionId) : undefined;
  }

  public setActiveSession(id: string): void {
    if (this.sessions.has(id)) {
      this.activeSessionId = id;
      this.onDidChangeSessionsEmitter.fire();
    }
  }

  public removeSession(id: string): void {
    this.sessions.delete(id);
    if (this.activeSessionId === id) {
      this.activeSessionId = [...this.sessions.keys()][0];
    }
    this.onDidChangeSessionsEmitter.fire();
  }

  public shiftWindow(id: string, delta: number): MultiDiffSession {
    const session = this.sessions.get(id);
    if (!session) {
      throw new Error(`Session not found: ${id}`);
    }

    const maxStart = Math.max(0, session.pairs.length - session.visiblePairCount);
    session.visibleStartPairIndex = Math.max(0, Math.min(maxStart, session.visibleStartPairIndex + delta));
    this.onDidChangeSessionsEmitter.fire();
    return session;
  }

  public buildPairs(
    repo: RepoContext,
    relativePath: string,
    revisions: readonly RevisionRef[],
    mode: SessionMode
  ): DiffPair[] {
    if (revisions.length < 2) {
      return [];
    }

    const pairs: DiffPair[] = [];

    if (mode === 'adjacent') {
      for (let index = 0; index < revisions.length - 1; index += 1) {
        const left = this.toSnapshot(repo, relativePath, revisions[index]);
        const right = this.toSnapshot(repo, relativePath, revisions[index + 1]);
        pairs.push({
          left,
          right,
          title: `${pathLabel(relativePath)} ${left.revision.slice(0, 8)} ↔ ${right.revision.slice(0, 8)}`
        });
      }
      return pairs;
    }

    const base = this.toSnapshot(repo, relativePath, revisions[0]);
    for (const revision of revisions.slice(1)) {
      const right = this.toSnapshot(repo, relativePath, revision);
      pairs.push({
        left: base,
        right,
        title: `${pathLabel(relativePath)} ${base.revision.slice(0, 8)} ↔ ${right.revision.slice(0, 8)}`
      });
    }

    return pairs;
  }

  private toSnapshot(repo: RepoContext, relativePath: string, revision: RevisionRef): SnapshotResource {
    return {
      repo,
      relativePath,
      revision: revision.id,
      uri: this.uriFactory.createSnapshotUri(repo, relativePath, revision.id),
      title: `${pathLabel(relativePath)} (${revision.shortLabel})`
    };
  }
}

function pathLabel(relativePath: string): string {
  return relativePath.split('/').at(-1) ?? relativePath;
}
