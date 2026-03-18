import * as vscode from 'vscode';

import { CommandContext } from './commandContext';

export function createOpenActiveSessionPairDiffCommand(context: CommandContext): () => Promise<void> {
  return async () => {
    const session = context.sessionService.getActiveBrowserSession();
    if (!session) {
      void vscode.window.showInformationMessage('No active Fukusa session.');
      return;
    }

    const pair = context.sessionService.getActivePair(session);
    if (!pair) {
      void vscode.window.showInformationMessage('No active comparison pair.');
      return;
    }

    const left = session.rawSnapshots[pair.leftRevisionIndex];
    const right = session.rawSnapshots[pair.rightRevisionIndex];
    await vscode.commands.executeCommand(
      'vscode.diff',
      left.rawUri,
      right.rawUri,
      `${left.revisionLabel} <-> ${right.revisionLabel} | ${left.relativePath}`,
      { preview: false, viewColumn: vscode.ViewColumn.Active }
    );
  };
}
