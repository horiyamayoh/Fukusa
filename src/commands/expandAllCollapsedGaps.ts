import * as vscode from 'vscode';

import { CommandContext } from './commandContext';
import { getCollapseProjectionOrNotify, SessionCommandTarget } from './shared';

export function createExpandAllCollapsedGapsCommand(context: CommandContext): (target?: SessionCommandTarget) => void {
  return (target) => {
    const activeProjection = getCollapseProjectionOrNotify(context, target);
    if (!activeProjection) {
      return;
    }

    const expanded = context.compareSessionController.expandAllSessionCollapsedGaps(activeProjection.session.id);
    if (!expanded) {
      void vscode.window.showInformationMessage('No collapsed gaps remain in the current Fukusa session.');
    }
  };
}
