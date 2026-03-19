import { CommandContext } from './commandContext';
import { getSessionTargetOrNotify, SessionCommandTarget } from './shared';

export function createRevealSessionCommand(context: CommandContext): (target?: SessionCommandTarget) => Promise<void> {
  return async (target) => {
    const session = getSessionTargetOrNotify(context, target);
    if (!session) {
      return;
    }

    await context.compareSessionController.revealSession(session.id);
  };
}
