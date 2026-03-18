import { CommandContext } from './commandContext';

export function createRevealSessionCommand(context: CommandContext): (sessionId: string) => Promise<void> {
  return async (sessionId: string) => {
    await context.nativeCompareSessionController.revealSession(sessionId);
  };
}
