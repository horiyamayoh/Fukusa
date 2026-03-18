import { CommandContext } from './commandContext';
import { openSession, resolveTargetResource } from './shared';

export function createOpenSessionBaseCommand(context: CommandContext): () => Promise<void> {
  return async () => {
    const resource = await resolveTargetResource(context);
    if (!resource) {
      return;
    }

    await openSession(context, resource);
  };
}
