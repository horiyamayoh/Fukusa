import * as vscode from 'vscode';

import { NWayCompareSession } from '../../adapters/common/types';
import { MAX_VISIBLE_REVISIONS, SessionService } from '../../application/sessionService';
import { OutputLogger } from '../../util/output';
import { DiffDecorationController } from './diffDecorationController';
import { EditorLayoutController } from './editorLayoutController';
import { EditorSyncController } from './editorSyncController';

export class NativeCompareSessionController implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];

  public constructor(
    private readonly sessionService: SessionService,
    private readonly editorLayoutController: EditorLayoutController,
    private readonly diffDecorationController: DiffDecorationController,
    private readonly editorSyncController: EditorSyncController,
    private readonly output: OutputLogger
  ) {
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (!editor) {
          return;
        }

        if (!this.sessionService.getSessionFileBinding(editor.document.uri)) {
          return;
        }

        this.sessionService.updateFocusFromUri(editor.document.uri);
      }),
      this.sessionService.onDidChangeSessions(() => {
        const session = this.sessionService.getActiveBrowserSession();
        if (!session) {
          this.editorSyncController.clear();
          this.diffDecorationController.refresh();
          return;
        }

        this.editorSyncController.setSession(session, this.sessionService.getVisibleWindow(session));
        this.diffDecorationController.refresh();
      })
    );
  }

  public async openSession(session: NWayCompareSession): Promise<void> {
    this.sessionService.setActiveBrowserSession(session.id);
    await this.renderSession(session);
  }

  public async revealSession(sessionId: string): Promise<void> {
    const session = this.sessionService.getBrowserSession(sessionId);
    if (!session) {
      void vscode.window.showInformationMessage('The requested Fukusa session no longer exists.');
      return;
    }

    await this.openSession(session);
  }

  public async shiftWindow(delta: number): Promise<void> {
    const session = this.sessionService.getActiveBrowserSession();
    if (!session) {
      void vscode.window.showInformationMessage('No active Fukusa session.');
      return;
    }

    const shifted = this.sessionService.shiftWindow(session.id, delta, MAX_VISIBLE_REVISIONS);
    if (!shifted) {
      return;
    }

    await this.renderSession(shifted);
  }

  public dispose(): void {
    while (this.disposables.length > 0) {
      this.disposables.pop()?.dispose();
    }
  }

  private async renderSession(session: NWayCompareSession): Promise<void> {
    const visibleWindow = this.sessionService.getVisibleWindow(session, MAX_VISIBLE_REVISIONS);
    if (visibleWindow.rawSnapshots.length === 0) {
      return;
    }

    if (
      session.activeRevisionIndex < visibleWindow.startRevisionIndex
      || session.activeRevisionIndex > visibleWindow.endRevisionIndex
    ) {
      this.sessionService.setActiveRevision(session.id, visibleWindow.startRevisionIndex);
    }

    const activeRevisionIndex = this.sessionService.getActiveSnapshot(session)?.revisionIndex ?? visibleWindow.startRevisionIndex;

    await this.editorLayoutController.setLayout(visibleWindow.rawSnapshots.length);

    for (const [index, snapshot] of visibleWindow.rawSnapshots.entries()) {
      const document = await vscode.workspace.openTextDocument(snapshot.rawUri);
      await vscode.window.showTextDocument(document, {
        viewColumn: toViewColumn(index),
        preview: true,
        preserveFocus: snapshot.revisionIndex !== activeRevisionIndex
      });
    }

    this.editorSyncController.setSession(session, visibleWindow);
    this.diffDecorationController.refresh();
    this.output.info(`Opened native compare session ${session.id} with ${visibleWindow.rawSnapshots.length} revisions.`);
  }
}

function toViewColumn(index: number): vscode.ViewColumn {
  return Math.max(1, Math.min(index + 1, MAX_VISIBLE_REVISIONS)) as vscode.ViewColumn;
}
