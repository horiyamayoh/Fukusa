import * as vscode from 'vscode';

import { NWayCompareSession } from '../../adapters/common/types';
import { getPairProjectionLabel } from '../../application/comparePairing';
import {
  getSessionCapabilityState,
  SessionCapabilityState
} from '../../application/sessionCapabilities';
import { SessionService } from '../../application/sessionService';

interface SessionTreeSessionElement {
  readonly kind: 'session';
  readonly sessionId: string;
}

interface SessionTreeSnapshotElement {
  readonly kind: 'snapshot';
  readonly sessionId: string;
  readonly revisionIndex: number;
}

type SessionTreeElement = SessionTreeSessionElement | SessionTreeSnapshotElement;

export class SessionsTreeProvider implements vscode.TreeDataProvider<SessionTreeElement> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<SessionTreeElement | undefined | null | void>();

  public readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  public constructor(private readonly sessionService: SessionService) {
    this.sessionService.onDidChangeSessions(() => this.refresh());
    this.sessionService.onDidChangeSessionViewState(() => this.refresh());
    this.sessionService.onDidChangeSessionProjection(() => this.refresh());
    this.sessionService.onDidChangeSessionPresentation(() => this.refresh());
  }

  public refresh(): void {
    this.onDidChangeTreeDataEmitter.fire();
  }

  public getTreeItem(element: SessionTreeElement): vscode.TreeItem {
    if (element.kind === 'session') {
      const session = this.sessionService.getBrowserSession(element.sessionId);
      if (!session) {
        return new vscode.TreeItem('Unavailable Session', vscode.TreeItemCollapsibleState.None);
      }

      const item = new vscode.TreeItem(pathLabel(session.relativePath), vscode.TreeItemCollapsibleState.Expanded);
      item.id = session.id;
      const rowProjectionState = this.sessionService.getRowProjectionState(session.id);
      const capabilities = getSessionCapabilityState(
        session,
        this.sessionService.getSessionViewState(session.id),
        rowProjectionState
      );
      item.contextValue = this.buildSessionContextValue(session, capabilities);
      item.description = [
        session.surfaceMode,
        capabilities.visibleRevisionLabel,
        capabilities.activeRevisionLabel ? `active ${capabilities.activeRevisionLabel}` : undefined,
        capabilities.activePairLabel ? `pair ${capabilities.activePairLabel}` : undefined,
        `${session.rowCount} rows`,
        getPairProjectionLabel(session.pairProjection),
        capabilities.collapseUnchanged ? 'collapsed' : 'full rows'
      ].filter((part): part is string => part !== undefined).join(' / ');
      item.tooltip = `${session.repo.kind} ${session.repo.repoRoot}`;
      item.command = {
        command: 'multidiff.internal.revealSession',
        title: 'Reveal Compare Session',
        arguments: [session.id]
      };
      return item;
    }

    const session = this.sessionService.getBrowserSession(element.sessionId);
    const snapshot = session?.rawSnapshots[element.revisionIndex];
    if (!session || !snapshot) {
      return new vscode.TreeItem('Unavailable Snapshot', vscode.TreeItemCollapsibleState.None);
    }

    const item = new vscode.TreeItem(
      `${snapshot.revisionLabel} | ${snapshot.relativePath}`,
      vscode.TreeItemCollapsibleState.None
    );
    item.id = `${element.sessionId}:${element.revisionIndex}`;
    item.contextValue = 'snapshot';
    const isActiveSnapshot = this.sessionService.getSessionViewState(element.sessionId).activeRevisionIndex === snapshot.revisionIndex;
    item.command = {
      command: 'multidiff.internal.openSessionSnapshot',
      title: 'Open Session Snapshot',
      arguments: [{
        sessionId: element.sessionId,
        revisionIndex: snapshot.revisionIndex
      }]
    };
    item.description = [
      snapshot.revisionId.slice(0, 12),
      isActiveSnapshot ? 'active' : undefined
    ].filter((part): part is string => part !== undefined).join(' / ');
    return item;
  }

  public getChildren(element?: SessionTreeElement): SessionTreeElement[] {
    if (!element) {
      return this.sessionService.listSessions().map((session) => ({
        kind: 'session',
        sessionId: session.id
      }));
    }

    if (element.kind !== 'session') {
      return [];
    }

    const session = this.sessionService.getBrowserSession(element.sessionId);
    if (!session) {
      return [];
    }

    return session.rawSnapshots.map((snapshot) => ({
      kind: 'snapshot',
      sessionId: session.id,
      revisionIndex: snapshot.revisionIndex
    }));
  }

  private buildSessionContextValue(
    session: NWayCompareSession,
    capabilities: SessionCapabilityState
  ): string {
    const tokens = ['session', `surface-${session.surfaceMode}`];
    if (capabilities.hasActiveSnapshot) {
      tokens.push('has-active-snapshot');
    }
    if (capabilities.hasActivePair) {
      tokens.push('has-active-pair');
    }
    if (capabilities.canChangePairProjection) {
      tokens.push('pair-projectable');
    }
    if (capabilities.canShiftWindow) {
      tokens.push('window-shiftable');
      if (capabilities.canShiftWindowLeft) {
        tokens.push('can-shift-window-left');
      }
      if (capabilities.canShiftWindowRight) {
        tokens.push('can-shift-window-right');
      }
    }
    if (capabilities.collapseUnchanged) {
      tokens.push('collapse-active');
      if (capabilities.hasCollapsedGaps) {
        tokens.push('has-collapsed-gaps');
      }
    }
    if (capabilities.hasExpandedGaps) {
      tokens.push('has-expanded-gaps');
    }

    return tokens.join(' ');
  }
}

function pathLabel(relativePath: string): string {
  return relativePath.split('/').at(-1) ?? relativePath;
}
