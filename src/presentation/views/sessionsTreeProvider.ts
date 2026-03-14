import * as vscode from 'vscode';

import { DiffPair, MultiDiffSession } from '../../adapters/common/types';
import { SessionService } from '../../application/sessionService';

type SessionTreeElement = MultiDiffSession | DiffPair;

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
      item.description = `${element.mode} | ${element.visibleStartPairIndex + 1}-${Math.min(element.pairs.length, element.visibleStartPairIndex + element.visiblePairCount)} / ${element.pairs.length}`;
      item.tooltip = `${element.repo.kind} ${element.repo.repoRoot}`;
      return item;
    }

    const item = new vscode.TreeItem(element.title, vscode.TreeItemCollapsibleState.None);
    item.command = {
      command: 'vscode.diff',
      title: 'Open Diff',
      arguments: [element.left.uri, element.right.uri, element.title, { preview: true }]
    };
    return item;
  }

  public getChildren(element?: SessionTreeElement): SessionTreeElement[] {
    if (!element) {
      return [...this.sessionService.listSessions()];
    }

    return isSession(element) ? [...element.pairs] : [];
  }
}

function isSession(element: SessionTreeElement): element is MultiDiffSession {
  return 'pairs' in element;
}

function pathLabel(relativePath: string): string {
  return relativePath.split('/').at(-1) ?? relativePath;
}
