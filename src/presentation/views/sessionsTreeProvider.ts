import * as vscode from 'vscode';

import { NWayCompareSession, RawSnapshot } from '../../adapters/common/types';
import { getPairProjectionLabel } from '../../application/comparePairing';
import {
  getSessionCapabilityState,
  SessionCapabilityState
} from '../../application/sessionCapabilities';
import { SessionService } from '../../application/sessionService';

interface SessionTreeSessionElement {
  readonly kind: 'session';
  readonly session: NWayCompareSession;
}

interface SessionTreeSnapshotElement {
  readonly kind: 'snapshot';
  readonly sessionId: string;
  readonly snapshot: RawSnapshot;
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
      const item = new vscode.TreeItem(pathLabel(element.session.relativePath), vscode.TreeItemCollapsibleState.Expanded);
      const rowProjectionState = this.sessionService.getRowProjectionState(element.session.id);
      const capabilities = getSessionCapabilityState(
        element.session,
        this.sessionService.getSessionViewState(element.session.id),
        rowProjectionState
      );
      item.contextValue = this.buildSessionContextValue(element.session, capabilities);
      item.description = [
        element.session.surfaceMode,
        capabilities.visibleRevisionLabel,
        capabilities.activeRevisionLabel ? `active ${capabilities.activeRevisionLabel}` : undefined,
        capabilities.activePairLabel ? `pair ${capabilities.activePairLabel}` : undefined,
        `${element.session.rowCount} rows`,
        getPairProjectionLabel(element.session.pairProjection),
        capabilities.collapseUnchanged ? 'collapsed' : 'full rows'
      ].filter((part): part is string => part !== undefined).join(' / ');
      item.tooltip = `${element.session.repo.kind} ${element.session.repo.repoRoot}`;
      item.command = {
        command: 'multidiff.internal.revealSession',
        title: 'Reveal Compare Session',
        arguments: [element.session.id]
      };
      return item;
    }

    const item = new vscode.TreeItem(
      `${element.snapshot.revisionLabel} | ${element.snapshot.relativePath}`,
      vscode.TreeItemCollapsibleState.None
    );
    item.contextValue = 'snapshot';
    const isActiveSnapshot = this.sessionService.getSessionViewState(element.sessionId).activeRevisionIndex === element.snapshot.revisionIndex;
    item.command = {
      command: 'multidiff.internal.openSessionSnapshot',
      title: 'Open Session Snapshot',
      arguments: [{
        sessionId: element.sessionId,
        revisionIndex: element.snapshot.revisionIndex
      }]
    };
    item.description = [
      element.snapshot.revisionId.slice(0, 12),
      isActiveSnapshot ? 'active' : undefined
    ].filter((part): part is string => part !== undefined).join(' / ');
    return item;
  }

  public getChildren(element?: SessionTreeElement): SessionTreeElement[] {
    if (!element) {
      return this.sessionService.listSessions().map((session) => ({
        kind: 'session',
        session
      }));
    }

    if (element.kind !== 'session') {
      return [];
    }

    return element.session.rawSnapshots.map((snapshot) => ({
      kind: 'snapshot',
      sessionId: element.session.id,
      snapshot
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
