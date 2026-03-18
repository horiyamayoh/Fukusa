import * as vscode from 'vscode';

import { CommandContext } from './commandContext';
import { openDiffSelection, resolveTargetResource } from './shared';

export function createOpenForExplorerFileCommand(context: CommandContext): (uri?: vscode.Uri) => Promise<void> {
  return async (uri?: vscode.Uri) => {
    const resource = await resolveTargetResource(context, uri);
    if (!resource) {
      return;
    }

    await openDiffSelection(context, resource);
  };
}
