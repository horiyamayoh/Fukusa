import { CommandContext } from './commandContext';
import * as vscode from 'vscode';
import { getSnapshotTargetOrNotify, SessionSnapshotCommandTarget } from './shared';

export function createOpenActiveSessionSnapshotCommand(
  context: CommandContext
): (target?: SessionSnapshotCommandTarget) => Promise<void> {
  return async (target) => {
    const activeSnapshot = getSnapshotTargetOrNotify(context, target);
    if (!activeSnapshot) {
      return;
    }

    context.sessionService.setActiveRevision(activeSnapshot.session.id, activeSnapshot.snapshot.revisionIndex);
    const textDocument = await vscode.workspace.openTextDocument(activeSnapshot.snapshot.rawUri);
    await vscode.window.showTextDocument(textDocument, { preview: false, viewColumn: vscode.ViewColumn.Active });
  };
}
