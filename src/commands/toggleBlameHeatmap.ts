import * as vscode from 'vscode';

import { CommandContext } from './commandContext';

export function createToggleBlameHeatmapCommand(context: CommandContext): () => Promise<void> {
  return async () => {
    const enabled = await context.blameDecorationController.toggle();
    void vscode.window.showInformationMessage(enabled ? 'Blame heatmap enabled.' : 'Blame heatmap disabled.');
  };
}
