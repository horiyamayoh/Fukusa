import * as vscode from 'vscode';

import { NWayCompareSession, RawSnapshot } from '../../adapters/common/types';
import { SessionService } from '../../application/sessionService';

type SessionTreeElement = NWayCompareSession | RawSnapshot;

export class SessionsTreeProvider implements vscode.TreeDataProvider<SessionTreeElement> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<SessionTreeElement | undefined | null | void>();

  public readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  public constructor(private readonly sessionService: SessionService) {
    this.sessionService.onDidChangeSessions(() => this.refresh());
  }

  public refresh(): void {
    this.onDidChangeTreeDataEmitter.fire();
  }

  public getTreeItem(element: SessionTreeElement): vscode.TreeItem {
    if (isSession(element)) {
      const item = new vscode.TreeItem(pathLabel(element.relativePath), vscode.TreeItemCollapsibleState.Expanded);
      item.description = `${element.rawSnapshots.length} revisions / ${element.rowCount} rows`;
      item.tooltip = `${element.repo.kind} ${element.repo.repoRoot}`;
      item.command = {
        command: 'multidiff.internal.revealSession',
        title: 'Reveal Compare Session',
        arguments: [element.id]
      };
      return item;
    }

    const item = new vscode.TreeItem(`${element.revisionLabel} | ${element.relativePath}`, vscode.TreeItemCollapsibleState.None);
    item.command = {
      command: 'vscode.open',
      title: 'Open Snapshot',
      arguments: [element.rawUri, { preview: false }]
    };
    item.description = element.revisionId.slice(0, 12);
    return item;
  }

  public getChildren(element?: SessionTreeElement): SessionTreeElement[] {
    if (!element) {
      return [...this.sessionService.listSessions()];
    }

    return isSession(element) ? [...element.rawSnapshots] : [];
  }
}

function isSession(element: SessionTreeElement): element is NWayCompareSession {
  return 'state' in element;
}

function pathLabel(relativePath: string): string {
  return relativePath.split('/').at(-1) ?? relativePath;
}
