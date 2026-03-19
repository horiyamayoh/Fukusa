import { CommandContext } from './commandContext';
import { getSessionTargetOrNotify, SessionCommandTarget } from './shared';

export function createToggleCollapseUnchangedCommand(context: CommandContext): (target?: SessionCommandTarget) => void {
  return (target) => {
    const session = getSessionTargetOrNotify(context, target);
    if (!session) {
      return;
    }

    context.compareSessionController.toggleSessionCollapseUnchanged(session.id);
  };
}
