import * as vscode from 'vscode';

import { CacheOverviewItem } from '../../adapters/common/types';
import { CacheService } from '../../application/cacheService';

interface CacheNamespaceTreeItem {
  readonly repoId: string;
  readonly namespace: string;
  readonly count: number;
}

type CacheTreeElement = CacheOverviewItem | CacheNamespaceTreeItem;

export class CacheTreeProvider implements vscode.TreeDataProvider<CacheTreeElement> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<CacheTreeElement | undefined | null | void>();

  public readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  public constructor(private readonly cacheService: CacheService) {
    this.cacheService.onDidChangeCache(() => this.refresh());
  }

  public refresh(): void {
    this.onDidChangeTreeDataEmitter.fire();
  }

  public getTreeItem(element: CacheTreeElement): vscode.TreeItem {
    if ('entryCount' in element) {
      const item = new vscode.TreeItem(element.repoId, vscode.TreeItemCollapsibleState.Collapsed);
      item.description = `${element.entryCount} entries | ${formatBytes(element.size)}`;
      return item;
    }

    const item = new vscode.TreeItem(element.namespace, vscode.TreeItemCollapsibleState.None);
    item.description = `${element.count} entries`;
    return item;
  }

  public async getChildren(element?: CacheTreeElement): Promise<CacheTreeElement[]> {
    if (!element) {
      return [...await this.cacheService.getOverview()];
    }

    if ('entryCount' in element) {
      return [...element.namespaces.entries()].map(([namespace, count]) => ({
        repoId: element.repoId,
        namespace,
        count
      }));
    }

    return [];
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KiB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}
