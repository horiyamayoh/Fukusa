import { CommandContext } from './commandContext';
import * as vscode from 'vscode';
import { getActivePairOrNotify, SessionCommandTarget } from './shared';

export function createOpenActiveSessionPairDiffCommand(
  context: CommandContext
): (target?: SessionCommandTarget) => Promise<void> {
  return async (target) => {
    const activePair = getActivePairOrNotify(context, target);
    if (!activePair) {
      return;
    }

    context.sessionService.setActivePair(activePair.session.id, activePair.pair.key);
    const left = activePair.session.rawSnapshots[activePair.pair.leftRevisionIndex];
    const right = activePair.session.rawSnapshots[activePair.pair.rightRevisionIndex];
    await vscode.commands.executeCommand(
      'vscode.diff',
      left.rawUri,
      right.rawUri,
      `${left.revisionLabel} <-> ${right.revisionLabel} | ${left.relativePath}`,
      { preview: false, viewColumn: vscode.ViewColumn.Active }
    );
  };
}
