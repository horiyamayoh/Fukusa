import * as vscode from 'vscode';

import { NWayCompareSession, SessionFileBinding, VisibleRevisionWindow } from '../../adapters/common/types';
import { SessionService } from '../../application/sessionService';

interface PendingSyncRequest {
  readonly sourceUri: vscode.Uri;
  readonly revisionIndex: number;
  readonly topGlobalRow: number;
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
  private verifyHandle: NodeJS.Timeout | undefined;
  private readonly lastRevealByUri = new Map<string, { readonly generation: number; readonly line: number }>();
  private readonly suppressedUris = new Map<string, number>();
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
    this.suppressedUris.clear();
  }

  public restoreTopGlobalRow(
    sessionId: string,
    topGlobalRow: number,
    renderGeneration = this.renderGeneration,
    windowStart = this.visibleWindow?.startRevisionIndex
  ): void {
    if (
      !this.visibleWindow
      || !this.activeSessionId
      || sessionId !== this.activeSessionId
      || renderGeneration !== this.renderGeneration
      || windowStart !== this.visibleWindow.startRevisionIndex
    ) {
      return;
    }

    this.syncInProgress = true;
    try {
      const suppressDeadline = Date.now() + 150;
      for (const editor of vscode.window.visibleTextEditors) {
        const binding = this.sessionService.getSessionFileBinding(editor.document.uri);
        if (
          !binding
          || binding.sessionId !== sessionId
          || binding.lineNumberSpace !== 'globalRow'
          || binding.windowStart !== windowStart
        ) {
          continue;
        }

        const safeLine = clampZeroBasedLine(editor.document, mapGlobalRowToDocumentLine(binding, topGlobalRow) - 1);
        if (this.shouldSkipReveal(editor, safeLine, renderGeneration)) {
          continue;
        }

        revealLineAtTop(editor, safeLine);
        const uriKey = editor.document.uri.toString(true);
        this.lastRevealByUri.set(uriKey, {
          generation: renderGeneration,
          line: safeLine
        });
        this.suppressedUris.set(uriKey, suppressDeadline);
      }
    } finally {
      this.syncInProgress = false;
    }
  }

  public async scrollActiveEditorAligned(delta: number): Promise<boolean> {
    if (!this.activeSessionId || !this.visibleWindow || delta === 0) {
      return false;
    }

    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      return false;
    }

    const binding = this.sessionService.getSessionFileBinding(activeEditor.document.uri);
    if (
      !binding
      || binding.sessionId !== this.activeSessionId
      || binding.lineNumberSpace !== 'globalRow'
      || binding.windowStart !== this.visibleWindow.startRevisionIndex
      || binding.projectedGlobalRows?.length === 0
    ) {
      return false;
    }

    const topDocumentLine = activeEditor.visibleRanges[0]?.start.line;
    if (topDocumentLine === undefined) {
      return false;
    }

    this.clearPendingSync();
    await vscode.commands.executeCommand('editorScroll', {
      to: delta < 0 ? 'up' : 'down',
      by: 'line',
      value: Math.abs(delta),
      revealCursor: false
    });

    const actualTopDocumentLine = activeEditor.visibleRanges[0]?.start.line;
    if (actualTopDocumentLine === undefined || actualTopDocumentLine === topDocumentLine) {
      return false;
    }

    const topGlobalRow = binding.projectedLineMap
      ? binding.projectedLineMap.documentLineToGlobalRow.get(actualTopDocumentLine + 1)
      : actualTopDocumentLine + 1;
    if (topGlobalRow === undefined) {
      return false;
    }

    const revealedEditors = this.syncPeers(
      this.activeSessionId,
      binding.revisionIndex,
      topGlobalRow,
      binding.windowStart,
      this.renderGeneration
    );
    if (revealedEditors.length > 0) {
      this.scheduleVerify(
        this.activeSessionId,
        binding.revisionIndex,
        topGlobalRow,
        binding.windowStart,
        this.renderGeneration
      );
    }
    return true;
  }

  public clear(): void {
    this.activeSessionId = undefined;
    this.visibleWindow = undefined;
    this.renderGeneration = 0;
    this.clearPendingSync();
    this.lastRevealByUri.clear();
    this.suppressedUris.clear();
  }

  public dispose(): void {
    this.clearPendingSync();
    this.clearVerifyHandle();
    while (this.disposables.length > 0) {
      this.disposables.pop()?.dispose();
    }
  }

  private async handleVisibleRangeChange(event: vscode.TextEditorVisibleRangesChangeEvent): Promise<void> {
    if (this.syncInProgress || !this.activeSessionId || !this.visibleWindow) {
      return;
    }

    const eventUriKey = event.textEditor.document.uri.toString(true);
    const suppressDeadline = this.suppressedUris.get(eventUriKey);
    if (suppressDeadline !== undefined) {
      if (Date.now() < suppressDeadline) {
        return;
      }

      this.suppressedUris.delete(eventUriKey);
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

    this.scheduleSync({
      sourceUri: event.textEditor.document.uri,
      revisionIndex: binding.revisionIndex,
      topGlobalRow: mapDocumentLineToGlobalRow(binding, firstVisibleRange.start.line + 1),
      generation: this.renderGeneration,
      windowStart: binding.windowStart
    });
  }

  private scheduleSync(request: PendingSyncRequest): void {
    this.pendingSync = request;
    this.clearPendingHandle();
    this.pendingHandle = setTimeout(() => {
      void this.flushPendingSync();
    }, 32);
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

    // Re-read the source editor's actual visible top line at flush time to account for
    // scroll momentum that may have changed the position since the event was captured.
    const sourceEditor = vscode.window.visibleTextEditors.find(
      (editor) => editor.document.uri.toString(true) === request.sourceUri.toString(true)
    );
    const freshTopLine = sourceEditor?.visibleRanges[0]?.start.line;
    const topGlobalRow = freshTopLine !== undefined
      ? mapDocumentLineToGlobalRow(sourceBinding, freshTopLine + 1)
      : request.topGlobalRow;

    const revealedEditors = this.syncPeers(session.id, request.revisionIndex, topGlobalRow, request.windowStart, request.generation);

    // Schedule a verification pass to correct any drift from imprecise revealRange positioning.
    if (revealedEditors.length > 0) {
      this.scheduleVerify(session.id, request.revisionIndex, topGlobalRow, request.windowStart, request.generation);
    }
  }

  private syncPeers(
    sessionId: string,
    sourceRevisionIndex: number,
    topGlobalRow: number,
    windowStart: number,
    generation: number
  ): Array<{ editor: vscode.TextEditor; targetLine: number }> {
    const revealed: Array<{ editor: vscode.TextEditor; targetLine: number }> = [];

    this.syncInProgress = true;
    try {
      const suppressDeadline = Date.now() + 150;
      for (const editor of vscode.window.visibleTextEditors) {
        const targetBinding = this.sessionService.getSessionFileBinding(editor.document.uri);
        if (
          !targetBinding
          || targetBinding.sessionId !== sessionId
          || targetBinding.lineNumberSpace !== 'globalRow'
          || targetBinding.windowStart !== windowStart
          || targetBinding.revisionIndex === sourceRevisionIndex
        ) {
          continue;
        }

        const safeLine = clampZeroBasedLine(editor.document, mapGlobalRowToDocumentLine(targetBinding, topGlobalRow) - 1);
        if (this.shouldSkipReveal(editor, safeLine, generation)) {
          continue;
        }

        revealLineAtTop(editor, safeLine);
        const uriKey = editor.document.uri.toString(true);
        this.lastRevealByUri.set(uriKey, {
          generation,
          line: safeLine
        });
        this.suppressedUris.set(uriKey, suppressDeadline);
        revealed.push({ editor, targetLine: safeLine });
      }
    } finally {
      this.syncInProgress = false;
    }

    return revealed;
  }

  private scheduleVerify(
    sessionId: string,
    sourceRevisionIndex: number,
    topGlobalRow: number,
    windowStart: number,
    generation: number
  ): void {
    this.clearVerifyHandle();
    this.verifyHandle = setTimeout(() => {
      this.verifyHandle = undefined;
      if (generation !== this.renderGeneration || this.activeSessionId !== sessionId) {
        return;
      }

      this.syncInProgress = true;
      try {
        const suppressDeadline = Date.now() + 150;
        for (const editor of vscode.window.visibleTextEditors) {
          const targetBinding = this.sessionService.getSessionFileBinding(editor.document.uri);
          if (
            !targetBinding
            || targetBinding.sessionId !== sessionId
            || targetBinding.lineNumberSpace !== 'globalRow'
            || targetBinding.windowStart !== windowStart
            || targetBinding.revisionIndex === sourceRevisionIndex
          ) {
            continue;
          }

          const safeLine = clampZeroBasedLine(editor.document, mapGlobalRowToDocumentLine(targetBinding, topGlobalRow) - 1);
          const actualTop = editor.visibleRanges[0]?.start.line;
          if (actualTop !== undefined && actualTop !== safeLine) {
            revealLineAtTop(editor, safeLine);
            const uriKey = editor.document.uri.toString(true);
            this.lastRevealByUri.set(uriKey, {
              generation,
              line: safeLine
            });
            this.suppressedUris.set(uriKey, suppressDeadline);
          }
        }
      } finally {
        this.syncInProgress = false;
      }
    }, 80);
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
    this.clearVerifyHandle();
  }

  private clearPendingHandle(): void {
    if (this.pendingHandle) {
      clearTimeout(this.pendingHandle);
      this.pendingHandle = undefined;
    }
  }

  private clearVerifyHandle(): void {
    if (this.verifyHandle) {
      clearTimeout(this.verifyHandle);
      this.verifyHandle = undefined;
    }
  }
}

/**
 * Returns the number of lines that VS Code's `revealRange(AtTop)` reserves above the
 * target line.  Internally VS Code computes:
 *
 *     paddingTop = Math.min(viewportHeight / 2, Math.max(cursorSurroundingLines, stickyEnabled ? maxStickyLines : 0)) * lineHeight
 *
 * and then scrolls so that the target line appears *below* that padding.  Because
 * `visibleRanges[0].start.line` reports the raw scroll position (without any sticky-scroll
 * adjustment), a naïve `revealRange(N, AtTop)` ends up placing the viewport start at
 * approximately `N − padding` lines, which desynchronises the scroll position from editors
 * whose position was set by user scrolling.
 *
 * We read the same configuration values and pre-add the padding so that the raw scroll
 * position after the reveal matches the intended line.
 */
function getRevealAtTopPadding(): number {
  const editorConfig = vscode.workspace.getConfiguration('editor');
  const stickyEnabled = editorConfig.get<boolean>('stickyScroll.enabled', true);
  const maxStickyLines = editorConfig.get<number>('stickyScroll.maxLineCount', 5);
  const cursorSurroundingLines = editorConfig.get<number>('cursorSurroundingLines', 0);
  return stickyEnabled
    ? Math.max(cursorSurroundingLines, maxStickyLines)
    : cursorSurroundingLines;
}

function revealLineAtTop(editor: vscode.TextEditor, line: number): void {
  const compensated = clampZeroBasedLine(editor.document, line + getRevealAtTopPadding());
  editor.revealRange(new vscode.Range(compensated, 0, compensated, 0), vscode.TextEditorRevealType.AtTop);
}

function clampZeroBasedLine(document: vscode.TextDocument, line: number): number {
  const lastLine = Math.max(0, document.lineCount - 1);
  return Math.max(0, Math.min(line, lastLine));
}

function mapDocumentLineToGlobalRow(binding: SessionFileBinding, documentLineNumber: number): number {
  return binding.projectedLineMap?.documentLineToGlobalRow.get(documentLineNumber) ?? documentLineNumber;
}

function mapGlobalRowToDocumentLine(binding: SessionFileBinding, globalRowNumber: number): number {
  const exactDocumentLineNumber = binding.projectedLineMap?.globalRowToDocumentLine.get(globalRowNumber);
  if (exactDocumentLineNumber !== undefined) {
    return exactDocumentLineNumber;
  }

  const projectedGlobalRows = binding.projectedGlobalRows;
  if (!projectedGlobalRows || projectedGlobalRows.length === 0) {
    return Math.max(1, globalRowNumber);
  }

  const atOrAfterIndex = projectedGlobalRows.findIndex((rowNumber) => rowNumber >= globalRowNumber);
  if (atOrAfterIndex >= 0) {
    return atOrAfterIndex + 1;
  }

  return projectedGlobalRows.length;
}
