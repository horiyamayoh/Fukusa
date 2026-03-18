import * as vscode from 'vscode';

import { CommandContext } from './commandContext';

export function createCloseActiveSessionCommand(context: CommandContext): () => Promise<void> {
  return async () => {
    const session = context.sessionService.getActiveBrowserSession();
    if (!session) {
      void vscode.window.showInformationMessage('No active Fukusa session.');
      return;
    }

    await context.nativeCompareSessionController.closeActiveSession();
  };
}
