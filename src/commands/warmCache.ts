import * as vscode from 'vscode';

import { CommandContext } from './commandContext';
import { resolveTargetResource, warmSnapshots } from './shared';

export function createWarmCacheCommand(context: CommandContext): () => Promise<void> {
  return async () => {
    const resource = await resolveTargetResource(context);
    if (!resource) {
      return;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Warming Fukusa cache'
      },
      async () => {
        await warmSnapshots(context, resource, 10);
      }
    );

    void vscode.window.showInformationMessage('Fukusa cache warmed for current file.');
  };
}
