import * as vscode from 'vscode';

import { AlignedLineMap, NWayCompareSession, VisibleRevisionWindow } from '../../adapters/common/types';
import { SessionService } from '../../application/sessionService';

export class EditorSyncController implements vscode.Disposable {
  private activeSessionId: string | undefined;
  private visibleWindow: VisibleRevisionWindow | undefined;
  private syncInProgress = false;
  private readonly disposables: vscode.Disposable[] = [];

  public constructor(private readonly sessionService: SessionService) {
    this.disposables.push(
      vscode.window.onDidChangeTextEditorVisibleRanges((event) => {
        void this.handleVisibleRangeChange(event);
      })
    );
  }

  public setSession(session: NWayCompareSession, visibleWindow: VisibleRevisionWindow): void {
    this.activeSessionId = session.id;
    this.visibleWindow = visibleWindow;
  }

  public clear(): void {
    this.activeSessionId = undefined;
    this.visibleWindow = undefined;
  }

  public dispose(): void {
    while (this.disposables.length > 0) {
      this.disposables.pop()?.dispose();
    }
  }

  private async handleVisibleRangeChange(event: vscode.TextEditorVisibleRangesChangeEvent): Promise<void> {
    if (this.syncInProgress || !this.activeSessionId || !this.visibleWindow) {
      return;
    }

    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor || !sameUri(activeEditor.document.uri, event.textEditor.document.uri)) {
      return;
    }

    const binding = this.sessionService.getSessionFileBinding(event.textEditor.document.uri);
    if (!binding || binding.sessionId !== this.activeSessionId) {
      return;
    }

    if (
      binding.revisionIndex < this.visibleWindow.startRevisionIndex
      || binding.revisionIndex > this.visibleWindow.endRevisionIndex
    ) {
      return;
    }

    const session = this.sessionService.getBrowserSession(this.activeSessionId);
    if (!session) {
      return;
    }

    const sourceSnapshot = session.rawSnapshots[binding.revisionIndex];
    const firstVisibleRange = event.visibleRanges[0];
    if (!firstVisibleRange) {
      return;
    }

    const sourceGlobalRow = resolveGlobalRow(sourceSnapshot.lineMap, firstVisibleRange.start.line + 1, session.rowCount);
    if (!sourceGlobalRow) {
      return;
    }

    this.syncInProgress = true;
    try {
      for (const snapshot of this.visibleWindow.rawSnapshots) {
        if (snapshot.revisionIndex === binding.revisionIndex) {
          continue;
        }

        const targetEditor = vscode.window.visibleTextEditors.find((editor) => sameUri(editor.document.uri, snapshot.rawUri));
        if (!targetEditor) {
          continue;
        }

        const targetLine = resolveOriginalLine(snapshot.lineMap, sourceGlobalRow, session.rowCount);
        const safeLine = clampLine(targetEditor.document, targetLine);
        const targetRange = new vscode.Range(safeLine, 0, safeLine, 0);
        targetEditor.revealRange(targetRange, vscode.TextEditorRevealType.AtTop);
      }
    } finally {
      this.syncInProgress = false;
    }
  }
}

function resolveGlobalRow(lineMap: AlignedLineMap, originalLineNumber: number, rowCount: number): number | undefined {
  const direct = lineMap.originalLineToRow.get(originalLineNumber);
  if (direct !== undefined) {
    return direct;
  }

  for (let offset = 1; offset <= rowCount; offset += 1) {
    const previous = lineMap.originalLineToRow.get(originalLineNumber - offset);
    if (previous !== undefined) {
      return previous;
    }

    const next = lineMap.originalLineToRow.get(originalLineNumber + offset);
    if (next !== undefined) {
      return next;
    }
  }

  return undefined;
}

function resolveOriginalLine(lineMap: AlignedLineMap, globalRow: number, rowCount: number): number | undefined {
  const direct = lineMap.rowToOriginalLine.get(globalRow);
  if (direct !== undefined) {
    return direct;
  }

  for (let offset = 1; offset <= rowCount; offset += 1) {
    const next = lineMap.rowToOriginalLine.get(globalRow + offset);
    if (next !== undefined) {
      return next;
    }

    const previous = lineMap.rowToOriginalLine.get(globalRow - offset);
    if (previous !== undefined) {
      return previous;
    }
  }

  return undefined;
}

function clampLine(document: vscode.TextDocument, originalLineNumber: number | undefined): number {
  const lastLine = Math.max(0, document.lineCount - 1);
  if (originalLineNumber === undefined) {
    return 0;
  }

  return Math.max(0, Math.min(originalLineNumber - 1, lastLine));
}

function sameUri(left: vscode.Uri, right: vscode.Uri): boolean {
  return left.toString(true) === right.toString(true);
}
