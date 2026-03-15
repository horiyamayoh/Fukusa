import * as vscode from 'vscode';

import { CommandContext } from './commandContext';
import { getRepoCacheId, resolveTargetResource } from './shared';

export function createClearCurrentRepoCacheCommand(context: CommandContext): () => Promise<void> {
  return async () => {
    const resource = await resolveTargetResource(context);
    if (!resource) {
      return;
    }

    await context.cacheService.clearRepo(getRepoCacheId(resource));
    void vscode.window.showInformationMessage('Cleared Fukusa cache for current repository.');
  };
}

export function createClearAllCacheCommand(context: CommandContext): () => Promise<void> {
  return async () => {
    await context.cacheService.clearAll();
    void vscode.window.showInformationMessage('Cleared all Fukusa cache.');
  };
}
