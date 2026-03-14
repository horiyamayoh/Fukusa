import * as vscode from 'vscode';

export class EditorLayoutController {
  public async setLayout(columns: number): Promise<void> {
    const safeColumns = Math.max(1, columns);
    await vscode.commands.executeCommand('vscode.setEditorLayout', {
      orientation: 0,
      groups: Array.from({ length: safeColumns }, () => ({}))
    });
  }
}
