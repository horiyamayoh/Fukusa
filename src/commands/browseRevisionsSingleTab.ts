import * as vscode from 'vscode';

import { CommandContext } from './commandContext';
import { browseAndOpenRevisions, resolveTargetResource } from './shared';

export function createBrowseRevisionsSingleTabCommand(context: CommandContext): (uri?: vscode.Uri) => Promise<void> {
  return async (uri?: vscode.Uri) => {
    const target = await resolveTargetResource(context, uri);
    if (!target) {
      return;
    }

    await browseAndOpenRevisions(context, target, undefined, 'panel');
  };
}

