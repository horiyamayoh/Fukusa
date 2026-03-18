import * as vscode from 'vscode';

import { CommandContext } from './commandContext';

export function createOpenActiveSessionSnapshotCommand(context: CommandContext): () => Promise<void> {
  return async () => {
    const session = context.sessionService.getActiveBrowserSession();
    if (!session) {
      void vscode.window.showInformationMessage('No active Fukusa session.');
      return;
    }

    const snapshot = context.sessionService.getActiveSnapshot(session);
    if (!snapshot) {
      void vscode.window.showInformationMessage('No active revision in the current Fukusa session.');
      return;
    }

    const textDocument = await vscode.workspace.openTextDocument(snapshot.rawUri);
    await vscode.window.showTextDocument(textDocument, { preview: false, viewColumn: vscode.ViewColumn.Active });
  };
}
