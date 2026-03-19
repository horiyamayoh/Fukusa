import * as vscode from 'vscode';

import { CommandContext } from './commandContext';
import { pickPairProjection } from './pairProjectionPicker';
import { canChangePairProjection, getSessionTargetOrNotify, SessionCommandTarget } from './shared';

export function createChangePairProjectionCommand(context: CommandContext): (target?: SessionCommandTarget) => Promise<void> {
  return async (target) => {
    const session = getSessionTargetOrNotify(context, target);
    if (!session) {
      return;
    }

    if (!canChangePairProjection(session)) {
      void vscode.window.showInformationMessage('Change Pair Projection is only useful when 3 or more revisions are open.');
      return;
    }

    const pairProjection = await pickPairProjection(session.revisions, {
      currentPairProjection: session.pairProjection,
      pairProjectionPlaceHolder: 'Choose how Fukusa should project pairs inside the active compare session.',
      customPairPlaceHolder: 'Choose which revision pairs Fukusa should project inside the active compare session.'
    });
    if (!pairProjection) {
      return;
    }

    context.sessionService.updatePairProjection(session.id, pairProjection);
  };
}
