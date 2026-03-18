import * as vscode from 'vscode';

import { NWayCompareSession, VisibleRevisionWindow } from '../../adapters/common/types';
import { SessionService } from '../../application/sessionService';

interface PendingSyncRequest {
  readonly sourceUri: vscode.Uri;
  readonly revisionIndex: number;
  readonly topLine: number;
  readonly generation: number;
  readonly windowStart: number;
}

export class EditorSyncController implements vscode.Disposable {
  private activeSessionId: string | undefined;
  private visibleWindow: VisibleRevisionWindow | undefined;
  private renderGeneration = 0;
  private syncInProgress = false;
  private pendingSync: PendingSyncRequest | undefined;
  private pendingHandle: NodeJS.Timeout | undefined;
  private readonly lastRevealByUri = new Map<string, { readonly generation: number; readonly line: number }>();
  private readonly disposables: vscode.Disposable[] = [];

  public constructor(private readonly sessionService: SessionService) {
    this.disposables.push(
      vscode.window.onDidChangeTextEditorVisibleRanges((event) => {
        void this.handleVisibleRangeChange(event);
      })
    );
  }

  public setSession(session: NWayCompareSession, visibleWindow: VisibleRevisionWindow, renderGeneration = 0): void {
    this.activeSessionId = session.id;
    this.visibleWindow = visibleWindow;
    this.renderGeneration = renderGeneration;
    this.clearPendingSync();
    this.lastRevealByUri.clear();
  }

  public clear(): void {
    this.activeSessionId = undefined;
    this.visibleWindow = undefined;
    this.renderGeneration = 0;
    this.clearPendingSync();
    this.lastRevealByUri.clear();
  }

  public dispose(): void {
    this.clearPendingSync();
    while (this.disposables.length > 0) {
      this.disposables.pop()?.dispose();
    }
  }

  private async handleVisibleRangeChange(event: vscode.TextEditorVisibleRangesChangeEvent): Promise<void> {
    if (this.syncInProgress || !this.activeSessionId || !this.visibleWindow) {
      return;
    }

    const binding = this.sessionService.getSessionFileBinding(event.textEditor.document.uri);
    if (
      !binding
      || binding.sessionId !== this.activeSessionId
      || binding.lineNumberSpace !== 'globalRow'
      || binding.windowStart !== this.visibleWindow.startRevisionIndex
    ) {
      return;
    }

    const firstVisibleRange = event.visibleRanges[0];
    if (!firstVisibleRange) {
      return;
    }

    this.sessionService.updateFocusFromUri(event.textEditor.document.uri);
    this.scheduleSync({
      sourceUri: event.textEditor.document.uri,
      revisionIndex: binding.revisionIndex,
      topLine: firstVisibleRange.start.line,
      generation: this.renderGeneration,
      windowStart: binding.windowStart
    });
  }

  private scheduleSync(request: PendingSyncRequest): void {
    this.pendingSync = request;
    this.clearPendingHandle();
    this.pendingHandle = setTimeout(() => {
      void this.flushPendingSync();
    }, 10);
  }

  private async flushPendingSync(): Promise<void> {
    this.clearPendingHandle();
    const request = this.pendingSync;
    this.pendingSync = undefined;
    if (!request || request.generation !== this.renderGeneration || !this.activeSessionId || !this.visibleWindow) {
      return;
    }

    const session = this.sessionService.getBrowserSession(this.activeSessionId);
    if (!session) {
      return;
    }

    const sourceBinding = this.sessionService.getSessionFileBinding(request.sourceUri);
    if (
      !sourceBinding
      || sourceBinding.sessionId !== session.id
      || sourceBinding.lineNumberSpace !== 'globalRow'
      || sourceBinding.windowStart !== request.windowStart
      || request.windowStart !== this.visibleWindow.startRevisionIndex
    ) {
      return;
    }

    this.syncInProgress = true;
    try {
      for (const editor of vscode.window.visibleTextEditors) {
        const targetBinding = this.sessionService.getSessionFileBinding(editor.document.uri);
        if (
          !targetBinding
          || targetBinding.sessionId !== session.id
          || targetBinding.lineNumberSpace !== 'globalRow'
          || targetBinding.windowStart !== request.windowStart
          || targetBinding.revisionIndex === request.revisionIndex
        ) {
          continue;
        }

        const safeLine = clampZeroBasedLine(editor.document, request.topLine);
        if (this.shouldSkipReveal(editor, safeLine, request.generation)) {
          continue;
        }

        editor.revealRange(new vscode.Range(safeLine, 0, safeLine, 0), vscode.TextEditorRevealType.AtTop);
        this.lastRevealByUri.set(editor.document.uri.toString(true), {
          generation: request.generation,
          line: safeLine
        });
      }
    } finally {
      this.syncInProgress = false;
    }
  }

  private shouldSkipReveal(editor: vscode.TextEditor, targetLine: number, generation: number): boolean {
    const visibleTop = editor.visibleRanges[0]?.start.line;
    if (visibleTop === targetLine) {
      return true;
    }

    const lastReveal = this.lastRevealByUri.get(editor.document.uri.toString(true));
    return lastReveal?.generation === generation && lastReveal.line === targetLine;
  }

  private clearPendingSync(): void {
    this.pendingSync = undefined;
    this.clearPendingHandle();
  }

  private clearPendingHandle(): void {
    if (this.pendingHandle) {
      clearTimeout(this.pendingHandle);
      this.pendingHandle = undefined;
    }
  }
}

function clampZeroBasedLine(document: vscode.TextDocument, line: number): number {
  const lastLine = Math.max(0, document.lineCount - 1);
  return Math.max(0, Math.min(line, lastLine));
}
