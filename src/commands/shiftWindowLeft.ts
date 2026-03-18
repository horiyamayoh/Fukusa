import * as vscode from 'vscode';

import { CommandContext } from './commandContext';
import { MAX_VISIBLE_REVISIONS } from '../application/sessionService';

export function createShiftWindowLeftCommand(context: CommandContext): () => Promise<void> {
  return async () => {
    const session = context.sessionService.getActiveBrowserSession();
    if (!session) {
      void vscode.window.showInformationMessage('No active Fukusa session.');
      return;
    }

    if (session.rawSnapshots.length <= MAX_VISIBLE_REVISIONS) {
      void vscode.window.showInformationMessage('Shift Window Left is only available when more than 9 revisions are open.');
      return;
    }

    await context.nativeCompareSessionController.shiftWindow(-1);
  };
}
