import { CommandContext } from './commandContext';

export function createScrollAlignedUpCommand(context: CommandContext): () => Promise<void> {
  return createScrollAlignedCommand(context, -1);
}

export function createScrollAlignedDownCommand(context: CommandContext): () => Promise<void> {
  return createScrollAlignedCommand(context, 1);
}

function createScrollAlignedCommand(context: CommandContext, delta: number): () => Promise<void> {
  return async () => {
    await context.compareSessionController.scrollActiveEditorAligned(delta);
  };
}
