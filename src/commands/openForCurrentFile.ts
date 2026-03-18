import { CommandContext } from './commandContext';
import { openDiffSelection, resolveTargetResource } from './shared';

export function createOpenForCurrentFileCommand(context: CommandContext): () => Promise<void> {
  return async () => {
    const resource = await resolveTargetResource(context);
    if (!resource) {
      return;
    }

    await openDiffSelection(context, resource);
  };
}
