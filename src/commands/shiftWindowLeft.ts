import * as vscode from 'vscode';

import { CommandContext } from './commandContext';
import { canShiftVisibleWindow, canShiftVisibleWindowLeft, getSessionTargetOrNotify, SessionCommandTarget } from './shared';

export function createShiftWindowLeftCommand(context: CommandContext): (target?: SessionCommandTarget) => Promise<void> {
  return async (target) => {
    const session = getSessionTargetOrNotify(context, target);
    if (!session) {
      return;
    }

    if (session.surfaceMode === 'panel') {
      void vscode.window.showInformationMessage('Shift Window Left is not needed in the single-tab compare panel.');
      return;
    }

    if (!canShiftVisibleWindow(session)) {
      void vscode.window.showInformationMessage('Shift Window Left is only available when more than 9 revisions are open.');
      return;
    }

    if (!canShiftVisibleWindowLeft(session, context.sessionService.getSessionViewState(session.id))) {
      void vscode.window.showInformationMessage('Already showing the first visible revision window.');
      return;
    }

    await context.compareSessionController.shiftSessionWindow(session.id, -1);
  };
}
