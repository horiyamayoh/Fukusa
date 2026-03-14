import { CommandContext } from './commandContext';

export function createShiftWindowRightCommand(context: CommandContext): () => Promise<void> {
  return async () => {
    await context.nativeDiffSessionController.shiftWindow(1);
  };
}
