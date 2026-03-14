import { CommandContext } from './commandContext';
import { openSingleSnapshot, resolveTargetResource } from './shared';

export function createOpenRevisionSnapshotCommand(context: CommandContext): () => Promise<void> {
  return async () => {
    const resource = await resolveTargetResource(context);
    if (!resource) {
      return;
    }

    await openSingleSnapshot(context, resource);
  };
}
