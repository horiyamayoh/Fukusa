import * as vscode from 'vscode';

import { CommandContext } from './commandContext';
import { resolveTargetResource } from './shared';

export function createOpenSnapshotAsTempFileCommand(context: CommandContext): () => Promise<void> {
  return async () => {
    const activeUri = vscode.window.activeTextEditor?.document.uri;
    if (activeUri?.scheme === 'multidiff') {
      await context.compatibilityService.openSnapshotAsTemp(activeUri);
      return;
    }

    const resource = await resolveTargetResource(context);
    if (!resource) {
      return;
    }

    const revision = await context.revisionPickerService.pickSingleRevision(resource);
    if (!revision) {
      return;
    }

    const snapshotUri = context.uriFactory.createSnapshotUri(resource.repo, resource.relativePath, revision.id);
    await context.compatibilityService.openSnapshotAsTemp(snapshotUri);
  };
}
