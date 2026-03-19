import * as vscode from 'vscode';

import { CompareSurfaceMode } from '../adapters/common/types';
import { CommandContext } from './commandContext';
import { getSessionTargetOrNotify, SessionCommandTarget } from './shared';

interface CompareSurfaceQuickPickItem extends vscode.QuickPickItem {
  readonly surfaceMode: CompareSurfaceMode;
}

export function createSwitchCompareSurfaceCommand(context: CommandContext): (target?: SessionCommandTarget) => Promise<void> {
  return async (target) => {
    const session = getSessionTargetOrNotify(context, target);
    if (!session) {
      return;
    }

    const selection = await vscode.window.showQuickPick(buildSurfaceItems(session.surfaceMode), {
      placeHolder: 'Choose which compare surface should host the active Fukusa session.'
    });
    if (!selection) {
      return;
    }

    const switched = await context.compareSessionController.switchSessionSurface(session.id, selection.surfaceMode);
    if (!switched) {
      void vscode.window.showWarningMessage('Failed to switch the active Fukusa compare surface.');
    }
  };
}

function buildSurfaceItems(currentSurfaceMode: CompareSurfaceMode): readonly CompareSurfaceQuickPickItem[] {
  return [
    {
      label: 'Single-Tab Panel',
      description: 'One scroll container with all revisions in one webview panel',
      detail: currentSurfaceMode === 'panel' ? 'Current surface' : undefined,
      surfaceMode: 'panel'
    },
    {
      label: 'Native Editors',
      description: 'VS Code text editors with native editor-group layout',
      detail: currentSurfaceMode === 'native' ? 'Current surface' : undefined,
      surfaceMode: 'native'
    }
  ] satisfies readonly CompareSurfaceQuickPickItem[];
}
