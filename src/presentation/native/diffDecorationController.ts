import * as vscode from 'vscode';

import { AdjacentPairOverlay, GlobalRowCell, IntralineSegment, NWayCompareSession } from '../../adapters/common/types';
import { SessionService } from '../../application/sessionService';

interface RevisionDecorations {
  readonly addedLines: vscode.DecorationOptions[];
  readonly removedLines: vscode.DecorationOptions[];
  readonly modifiedLines: vscode.DecorationOptions[];
  readonly secondaryLines: vscode.DecorationOptions[];
  readonly addedText: vscode.DecorationOptions[];
  readonly removedText: vscode.DecorationOptions[];
}

export class DiffDecorationController implements vscode.Disposable {
  private addedLineType: vscode.TextEditorDecorationType | undefined;
  private removedLineType: vscode.TextEditorDecorationType | undefined;
  private modifiedLineType: vscode.TextEditorDecorationType | undefined;
  private secondaryLineType: vscode.TextEditorDecorationType | undefined;
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
    const activePair = this.sessionService.getActivePair(session);
    const decorationsByRevision = new Map<number, RevisionDecorations>();

    for (const pair of session.adjacentPairs) {
      if (!pairIsVisible(pair, visibleWindow.startRevisionIndex, visibleWindow.endRevisionIndex)) {
        continue;
      }

      if (activePair && pair.key === activePair.key) {
        this.collectActivePairDecorations(session, pair, decorationsByRevision);
      } else {
        this.collectSecondaryPairDecorations(session, pair, decorationsByRevision);
      }
    }

    for (const snapshot of visibleWindow.rawSnapshots) {
      const editor = vscode.window.visibleTextEditors.find((candidate) => sameUri(candidate.document.uri, snapshot.rawUri));
      if (!editor) {
        continue;
      }

      const decorations = decorationsByRevision.get(snapshot.revisionIndex);
      if (!decorations) {
        continue;
      }

      editor.setDecorations(this.addedLineType!, decorations.addedLines);
      editor.setDecorations(this.removedLineType!, decorations.removedLines);
      editor.setDecorations(this.modifiedLineType!, decorations.modifiedLines);
      editor.setDecorations(this.secondaryLineType!, decorations.secondaryLines);
      editor.setDecorations(this.addedTextType!, decorations.addedText);
      editor.setDecorations(this.removedTextType!, decorations.removedText);
    }
  }

  public dispose(): void {
    this.clearVisibleEditors();
    for (const type of [
      this.addedLineType,
      this.removedLineType,
      this.modifiedLineType,
      this.secondaryLineType,
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
    this.addedLineType?.dispose();
    this.removedLineType?.dispose();
    this.modifiedLineType?.dispose();
    this.secondaryLineType?.dispose();
    this.addedTextType?.dispose();
    this.removedTextType?.dispose();

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
    this.secondaryLineType = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      borderColor: new vscode.ThemeColor('editorLineNumber.foreground'),
      borderStyle: 'solid',
      borderWidth: '0 0 0 2px'
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

      editor.setDecorations(this.addedLineType!, []);
      editor.setDecorations(this.removedLineType!, []);
      editor.setDecorations(this.modifiedLineType!, []);
      editor.setDecorations(this.secondaryLineType!, []);
      editor.setDecorations(this.addedTextType!, []);
      editor.setDecorations(this.removedTextType!, []);
    }
  }

  private collectActivePairDecorations(
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

      if (leftCell.present && leftCell.originalLineNumber !== undefined) {
        const leftDecorations = getOrCreateDecorations(decorationsByRevision, pair.leftRevisionIndex);
        if (!rightCell.present) {
          leftDecorations.removedLines.push(toWholeLineDecoration(leftCell.originalLineNumber));
        } else if (leftCell.text !== rightCell.text) {
          leftDecorations.modifiedLines.push(toWholeLineDecoration(leftCell.originalLineNumber));
          pushIntralineDecorations(leftDecorations.removedText, leftCell.originalLineNumber, leftCell.nextChange?.intralineSegments);
        }
      }

      if (rightCell.present && rightCell.originalLineNumber !== undefined) {
        const rightDecorations = getOrCreateDecorations(decorationsByRevision, pair.rightRevisionIndex);
        if (!leftCell.present) {
          rightDecorations.addedLines.push(toWholeLineDecoration(rightCell.originalLineNumber));
        } else if (leftCell.text !== rightCell.text) {
          rightDecorations.modifiedLines.push(toWholeLineDecoration(rightCell.originalLineNumber));
          pushIntralineDecorations(rightDecorations.addedText, rightCell.originalLineNumber, rightCell.prevChange?.intralineSegments);
        }
      }
    }
  }

  private collectSecondaryPairDecorations(
    session: NWayCompareSession,
    pair: AdjacentPairOverlay,
    decorationsByRevision: Map<number, RevisionDecorations>
  ): void {
    for (const rowNumber of pair.changedRowNumbers) {
      const row = session.globalRows[rowNumber - 1];
      if (!row) {
        continue;
      }

      pushSecondaryLine(decorationsByRevision, pair.leftRevisionIndex, row.cells[pair.leftRevisionIndex]);
      pushSecondaryLine(decorationsByRevision, pair.rightRevisionIndex, row.cells[pair.rightRevisionIndex]);
    }
  }
}

function pushSecondaryLine(
  decorationsByRevision: Map<number, RevisionDecorations>,
  revisionIndex: number,
  cell: GlobalRowCell
): void {
  if (!cell.present || cell.originalLineNumber === undefined) {
    return;
  }

  getOrCreateDecorations(decorationsByRevision, revisionIndex).secondaryLines.push(
    toWholeLineDecoration(cell.originalLineNumber)
  );
}

function pushIntralineDecorations(
  target: vscode.DecorationOptions[],
  originalLineNumber: number,
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
        originalLineNumber - 1,
        segment.startCharacter,
        originalLineNumber - 1,
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
    addedLines: [],
    removedLines: [],
    modifiedLines: [],
    secondaryLines: [],
    addedText: [],
    removedText: []
  };
  decorationsByRevision.set(revisionIndex, created);
  return created;
}

function toWholeLineDecoration(originalLineNumber: number): vscode.DecorationOptions {
  return {
    range: new vscode.Range(originalLineNumber - 1, 0, originalLineNumber - 1, 0)
  };
}

function pairIsVisible(pair: AdjacentPairOverlay, startRevisionIndex: number, endRevisionIndex: number): boolean {
  return pair.leftRevisionIndex >= startRevisionIndex && pair.rightRevisionIndex <= endRevisionIndex;
}

function sameUri(left: vscode.Uri, right: vscode.Uri): boolean {
  return left.toString(true) === right.toString(true);
}
