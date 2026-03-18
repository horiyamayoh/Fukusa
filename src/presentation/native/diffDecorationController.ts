import * as vscode from 'vscode';

import { AdjacentPairOverlay, GlobalRowCell, IntralineSegment, NWayCompareSession } from '../../adapters/common/types';
import { SessionService } from '../../application/sessionService';

interface RevisionDecorations {
  readonly previousPairEdges: vscode.DecorationOptions[];
  readonly nextPairEdges: vscode.DecorationOptions[];
  readonly addedLines: vscode.DecorationOptions[];
  readonly removedLines: vscode.DecorationOptions[];
  readonly modifiedLines: vscode.DecorationOptions[];
  readonly addedText: vscode.DecorationOptions[];
  readonly removedText: vscode.DecorationOptions[];
}

export interface RevisionDecorationModel {
  readonly previousPairEdges: readonly number[];
  readonly nextPairEdges: readonly number[];
  readonly addedLines: readonly number[];
  readonly removedLines: readonly number[];
  readonly modifiedLines: readonly number[];
  readonly addedText: readonly TextSegmentDecorationModel[];
  readonly removedText: readonly TextSegmentDecorationModel[];
}

export interface TextSegmentDecorationModel {
  readonly lineNumber: number;
  readonly startCharacter: number;
  readonly endCharacter: number;
}

export class DiffDecorationController implements vscode.Disposable {
  private previousPairEdgeType: vscode.TextEditorDecorationType | undefined;
  private nextPairEdgeType: vscode.TextEditorDecorationType | undefined;
  private addedLineType: vscode.TextEditorDecorationType | undefined;
  private removedLineType: vscode.TextEditorDecorationType | undefined;
  private modifiedLineType: vscode.TextEditorDecorationType | undefined;
  private addedTextType: vscode.TextEditorDecorationType | undefined;
  private removedTextType: vscode.TextEditorDecorationType | undefined;
  private readonly disposables: vscode.Disposable[] = [];

  public constructor(private readonly sessionService: SessionService) {
    this.recreateDecorationTypes();
    this.disposables.push(
      this.sessionService.onDidChangeSessions(() => this.refresh()),
      vscode.window.onDidChangeVisibleTextEditors(() => this.refresh()),
      vscode.window.onDidChangeActiveColorTheme(() => {
        this.recreateDecorationTypes();
        this.refresh();
      })
    );
  }

  public refresh(): void {
    this.clearVisibleEditors();

    const session = this.sessionService.getActiveBrowserSession();
    if (!session) {
      return;
    }

    const visibleWindow = this.sessionService.getVisibleWindow(session);
    const decorationsByRevision = buildRevisionDecorationModels(
      session,
      visibleWindow.startRevisionIndex,
      visibleWindow.endRevisionIndex,
      this.sessionService.getActivePair(session)?.key
    );

    for (const editor of vscode.window.visibleTextEditors) {
      const binding = this.sessionService.getSessionFileBinding(editor.document.uri);
      if (
        !binding
        || binding.sessionId !== session.id
        || binding.lineNumberSpace !== 'globalRow'
        || binding.windowStart !== visibleWindow.startRevisionIndex
      ) {
        continue;
      }

      const decorations = decorationsByRevision.get(binding.revisionIndex);
      if (!decorations) {
        continue;
      }

      editor.setDecorations(this.previousPairEdgeType!, decorations.previousPairEdges);
      editor.setDecorations(this.nextPairEdgeType!, decorations.nextPairEdges);
      editor.setDecorations(this.addedLineType!, decorations.addedLines);
      editor.setDecorations(this.removedLineType!, decorations.removedLines);
      editor.setDecorations(this.modifiedLineType!, decorations.modifiedLines);
      editor.setDecorations(this.addedTextType!, decorations.addedText);
      editor.setDecorations(this.removedTextType!, decorations.removedText);
    }
  }

  public dispose(): void {
    this.clearVisibleEditors();
    for (const type of [
      this.previousPairEdgeType,
      this.nextPairEdgeType,
      this.addedLineType,
      this.removedLineType,
      this.modifiedLineType,
      this.addedTextType,
      this.removedTextType
    ]) {
      type?.dispose();
    }

    while (this.disposables.length > 0) {
      this.disposables.pop()?.dispose();
    }
  }

  private recreateDecorationTypes(): void {
    this.previousPairEdgeType?.dispose();
    this.nextPairEdgeType?.dispose();
    this.addedLineType?.dispose();
    this.removedLineType?.dispose();
    this.modifiedLineType?.dispose();
    this.addedTextType?.dispose();
    this.removedTextType?.dispose();

    this.previousPairEdgeType = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      borderColor: new vscode.ThemeColor('diffEditor.removedLineBackground'),
      borderStyle: 'solid',
      borderWidth: '0 0 0 2px'
    });
    this.nextPairEdgeType = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      borderColor: new vscode.ThemeColor('diffEditor.insertedLineBackground'),
      borderStyle: 'solid',
      borderWidth: '0 2px 0 0'
    });
    this.addedLineType = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      backgroundColor: new vscode.ThemeColor('diffEditor.insertedLineBackground'),
      overviewRulerColor: new vscode.ThemeColor('diffEditor.insertedLineBackground'),
      overviewRulerLane: vscode.OverviewRulerLane.Right
    });
    this.removedLineType = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      backgroundColor: new vscode.ThemeColor('diffEditor.removedLineBackground'),
      overviewRulerColor: new vscode.ThemeColor('diffEditor.removedLineBackground'),
      overviewRulerLane: vscode.OverviewRulerLane.Right
    });
    this.modifiedLineType = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      backgroundColor: new vscode.ThemeColor('editor.findMatchHighlightBackground'),
      overviewRulerColor: new vscode.ThemeColor('editorInfo.foreground'),
      overviewRulerLane: vscode.OverviewRulerLane.Right
    });
    this.addedTextType = vscode.window.createTextEditorDecorationType({
      backgroundColor: new vscode.ThemeColor('diffEditor.insertedTextBackground')
    });
    this.removedTextType = vscode.window.createTextEditorDecorationType({
      backgroundColor: new vscode.ThemeColor('diffEditor.removedTextBackground')
    });
  }

  private clearVisibleEditors(): void {
    for (const editor of vscode.window.visibleTextEditors) {
      if (!this.sessionService.getSessionFileBinding(editor.document.uri)) {
        continue;
      }

      editor.setDecorations(this.previousPairEdgeType!, []);
      editor.setDecorations(this.nextPairEdgeType!, []);
      editor.setDecorations(this.addedLineType!, []);
      editor.setDecorations(this.removedLineType!, []);
      editor.setDecorations(this.modifiedLineType!, []);
      editor.setDecorations(this.addedTextType!, []);
      editor.setDecorations(this.removedTextType!, []);
    }
  }
}

export function buildRevisionDecorationModels(
  session: NWayCompareSession,
  startRevisionIndex: number,
  endRevisionIndex: number,
  activePairKey: string | undefined
): Map<number, RevisionDecorations> {
  const decorationsByRevision = new Map<number, RevisionDecorations>();

  for (const row of session.globalRows) {
    for (let revisionIndex = startRevisionIndex; revisionIndex <= endRevisionIndex; revisionIndex += 1) {
      const cell = row.cells[revisionIndex];
      pushPairEdgeDecorations(decorationsByRevision, startRevisionIndex, endRevisionIndex, revisionIndex, cell);
    }
  }

  const activePair = session.adjacentPairs.find((pair) => (
    pair.key === activePairKey && pairIsVisible(pair, startRevisionIndex, endRevisionIndex)
  ));
  if (activePair) {
    collectActivePairDecorations(session, activePair, decorationsByRevision);
  }

  return decorationsByRevision;
}

function pushPairEdgeDecorations(
  decorationsByRevision: Map<number, RevisionDecorations>,
  startRevisionIndex: number,
  endRevisionIndex: number,
  revisionIndex: number,
  cell: GlobalRowCell
): void {
  const decorations = getOrCreateDecorations(decorationsByRevision, revisionIndex);
  if (revisionIndex > startRevisionIndex && cell.prevChange) {
    decorations.previousPairEdges.push(toWholeLineDecoration(cell.rowNumber));
  }
  if (revisionIndex < endRevisionIndex && cell.nextChange) {
    decorations.nextPairEdges.push(toWholeLineDecoration(cell.rowNumber));
  }
}

function collectActivePairDecorations(
  session: NWayCompareSession,
  pair: AdjacentPairOverlay,
  decorationsByRevision: Map<number, RevisionDecorations>
): void {
  for (const rowNumber of pair.changedRowNumbers) {
    const row = session.globalRows[rowNumber - 1];
    if (!row) {
      continue;
    }

    const leftCell = row.cells[pair.leftRevisionIndex];
    const rightCell = row.cells[pair.rightRevisionIndex];

    if (leftCell.present) {
      const leftDecorations = getOrCreateDecorations(decorationsByRevision, pair.leftRevisionIndex);
      if (!rightCell.present) {
        leftDecorations.removedLines.push(toWholeLineDecoration(leftCell.rowNumber));
      } else if (leftCell.text !== rightCell.text) {
        leftDecorations.modifiedLines.push(toWholeLineDecoration(leftCell.rowNumber));
        pushIntralineDecorations(leftDecorations.removedText, leftCell.rowNumber, leftCell.nextChange?.intralineSegments);
      }
    }

    if (rightCell.present) {
      const rightDecorations = getOrCreateDecorations(decorationsByRevision, pair.rightRevisionIndex);
      if (!leftCell.present) {
        rightDecorations.addedLines.push(toWholeLineDecoration(rightCell.rowNumber));
      } else if (leftCell.text !== rightCell.text) {
        rightDecorations.modifiedLines.push(toWholeLineDecoration(rightCell.rowNumber));
        pushIntralineDecorations(rightDecorations.addedText, rightCell.rowNumber, rightCell.prevChange?.intralineSegments);
      }
    }
  }
}

function pushIntralineDecorations(
  target: vscode.DecorationOptions[],
  lineNumber: number,
  segments: readonly IntralineSegment[] | undefined
): void {
  if (!segments) {
    return;
  }

  for (const segment of segments) {
    if (segment.endCharacter <= segment.startCharacter) {
      continue;
    }

    target.push({
      range: new vscode.Range(
        lineNumber - 1,
        segment.startCharacter,
        lineNumber - 1,
        segment.endCharacter
      )
    });
  }
}

function getOrCreateDecorations(
  decorationsByRevision: Map<number, RevisionDecorations>,
  revisionIndex: number
): RevisionDecorations {
  const existing = decorationsByRevision.get(revisionIndex);
  if (existing) {
    return existing;
  }

  const created: RevisionDecorations = {
    previousPairEdges: [],
    nextPairEdges: [],
    addedLines: [],
    removedLines: [],
    modifiedLines: [],
    addedText: [],
    removedText: []
  };
  decorationsByRevision.set(revisionIndex, created);
  return created;
}

function toWholeLineDecoration(lineNumber: number): vscode.DecorationOptions {
  return {
    range: new vscode.Range(lineNumber - 1, 0, lineNumber - 1, 0)
  };
}

function pairIsVisible(pair: AdjacentPairOverlay, startRevisionIndex: number, endRevisionIndex: number): boolean {
  return pair.leftRevisionIndex >= startRevisionIndex && pair.rightRevisionIndex <= endRevisionIndex;
}
