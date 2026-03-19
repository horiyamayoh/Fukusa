import * as vscode from 'vscode';

import { CommandContext } from './commandContext';
import { getCollapseProjectionOrNotify, SessionCommandTarget } from './shared';

export function createResetExpandedGapsCommand(context: CommandContext): (target?: SessionCommandTarget) => void {
  return (target) => {
    const activeProjection = getCollapseProjectionOrNotify(context, target);
    if (!activeProjection) {
      return;
    }

    const reset = context.compareSessionController.resetSessionExpandedGaps(activeProjection.session.id);
    if (!reset) {
      void vscode.window.showInformationMessage('No expanded gaps are active in the current Fukusa session.');
    }
  };
}
