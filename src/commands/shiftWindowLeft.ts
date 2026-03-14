import { CommandContext } from './commandContext';

export function createShiftWindowLeftCommand(context: CommandContext): () => Promise<void> {
  return async () => {
    await context.nativeDiffSessionController.shiftWindow(-1);
  };
}
