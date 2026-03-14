import * as vscode from 'vscode';

import { MultiDiffSession } from '../../adapters/common/types';
import { SessionService } from '../../application/sessionService';
import { OutputLogger } from '../../util/output';
import { LanguageFeatureCompatibilityService } from '../../application/languageFeatureCompatibilityService';
import { EditorLayoutController } from './editorLayoutController';

export class NativeDiffSessionController {
  public constructor(
    private readonly sessionService: SessionService,
    private readonly editorLayoutController: EditorLayoutController,
    private readonly compatibilityService: LanguageFeatureCompatibilityService,
    private readonly output: OutputLogger
  ) {}

  public async openSession(session: MultiDiffSession): Promise<void> {
    this.sessionService.setActiveSession(session.id);
    await this.renderSession(session);
  }

  public async shiftWindow(delta: number): Promise<void> {
    const session = this.sessionService.getActiveSession();
    if (!session) {
      void vscode.window.showInformationMessage('No active MultiDiff session.');
      return;
    }

    const shifted = this.sessionService.shiftWindow(session.id, delta);
    await this.renderSession(shifted);
  }

  private async renderSession(session: MultiDiffSession): Promise<void> {
    const visiblePairs = session.pairs.slice(
      session.visibleStartPairIndex,
      session.visibleStartPairIndex + session.visiblePairCount
    );

    await this.editorLayoutController.setLayout(visiblePairs.length);

    for (let index = 0; index < visiblePairs.length; index += 1) {
      const pair = visiblePairs[index];
      const left = await this.compatibilityService.resolveSnapshotUri(pair.left.uri);
      const right = await this.compatibilityService.resolveSnapshotUri(pair.right.uri);
      await vscode.commands.executeCommand('vscode.diff', left, right, pair.title, {
        viewColumn: index + 1,
        preview: true,
        preserveFocus: index > 0
      });
    }

    this.output.info(`Opened session ${session.id} with ${visiblePairs.length} visible pairs.`);
  }
}
