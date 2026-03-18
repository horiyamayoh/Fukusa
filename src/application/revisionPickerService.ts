import * as vscode from 'vscode';

import { ResolvedResource, RevisionRef } from '../adapters/common/types';
import { RepositoryService } from './repositoryService';
import { CacheService } from './cacheService';
import { createHistoryCacheKey } from '../infrastructure/cache/cacheKeys';

interface RevisionQuickPickItem extends vscode.QuickPickItem {
  readonly revision: RevisionRef;
}

export function applySelectionOrder(previousOrder: readonly string[], selectedIds: readonly string[]): string[] {
  const retained = previousOrder.filter((id) => selectedIds.includes(id));
  for (const id of selectedIds) {
    if (!retained.includes(id)) {
      retained.push(id);
    }
  }
  return retained;
}

export class RevisionPickerService {
  public constructor(
    private readonly repositoryService: RepositoryService,
    private readonly cacheService: CacheService
  ) {}

  public async getHistory(resource: ResolvedResource, limit = 30): Promise<RevisionRef[]> {
    const adapter = this.repositoryService.getAdapter(resource.repo.kind);
    const result = await this.cacheService.getOrLoadJson(
      createHistoryCacheKey(resource.repo, resource.relativePath, limit),
      () => adapter.getHistory(resource.repo, resource.relativePath, limit)
    );
    return result.value;
  }

  public async pickSingleRevision(resource: ResolvedResource, limit = 30): Promise<RevisionRef | undefined> {
    const items = await this.getItems(resource, limit);
    return (await vscode.window.showQuickPick(items, {
      canPickMany: false,
      placeHolder: 'Choose a revision to open as a readonly snapshot.'
    }))?.revision;
  }

  public async pickMultipleRevisions(
    resource: ResolvedResource,
    options: { readonly minSelection: number; readonly limit?: number; readonly placeHolder?: string }
  ): Promise<RevisionRef[] | undefined> {
    const items = await this.getItems(resource, options.limit ?? 30);
    const picked = await vscode.window.showQuickPick(items, {
      canPickMany: true,
      placeHolder: options.placeHolder ?? `Choose at least ${options.minSelection} revisions.`
    });

    if (!picked || picked.length < options.minSelection) {
      if (picked && picked.length > 0) {
        void vscode.window.showWarningMessage(`Select at least ${options.minSelection} revisions.`);
      }
      return undefined;
    }

    const selected = picked.map((item) => item.revision);
    return [...selected].sort((left, right) => {
      if (typeof left.timestamp === 'number' && typeof right.timestamp === 'number' && left.timestamp !== right.timestamp) {
        return left.timestamp - right.timestamp;
      }

      return items.findIndex((item) => item.revision.id === right.id) - items.findIndex((item) => item.revision.id === left.id);
    });
  }

  private async getItems(resource: ResolvedResource, limit: number): Promise<RevisionQuickPickItem[]> {
    const revisions = await this.getHistory(resource, limit);
    return revisions.map((revision) => ({
      label: revision.shortLabel,
      description: revision.author,
      detail: [revision.message, revision.timestamp ? new Date(revision.timestamp).toLocaleString() : undefined]
        .filter(Boolean)
        .join(' | '),
      revision
    }));
  }
}
