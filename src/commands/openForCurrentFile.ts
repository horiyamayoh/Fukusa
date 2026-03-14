import { CommandContext } from './commandContext';
import { openPairDiff, resolveTargetResource } from './shared';

export function createOpenForCurrentFileCommand(context: CommandContext): () => Promise<void> {
  return async () => {
    const resource = await resolveTargetResource(context);
    if (!resource) {
      return;
    }

    await openPairDiff(context, resource);
  };
}
