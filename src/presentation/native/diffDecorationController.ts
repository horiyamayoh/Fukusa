import * as vscode from 'vscode';

import { ComparePairOverlay, IntralineSegment, NWayCompareSession, SessionProjectedLineMap } from '../../adapters/common/types';
import { buildCompareRowDisplayState, CompareRowDisplayState } from '../../application/compareRowDisplayState';
import { getPairOverlay, getVisiblePairOverlays } from '../../application/comparePairing';
import { SessionService } from '../../application/sessionService';
import { buildSessionViewport } from '../../application/sessionViewport';

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

interface VisibleSessionDecorationState {
  readonly windowStart: number;
  readonly decorationsByRevision: Map<number, RevisionDecorations>;
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
    const visibleSessionStates = this.collectVisibleSessionStates();
    this.clearVisibleEditors();

    for (const editor of vscode.window.visibleTextEditors) {
      const binding = this.sessionService.getSessionFileBinding(editor.document.uri);
      if (
        !binding
        || binding.lineNumberSpace !== 'globalRow'
      ) {
        continue;
      }

      const sessionState = visibleSessionStates.get(binding.sessionId);
      if (!sessionState || binding.windowStart !== sessionState.windowStart) {
        continue;
      }

      const decorations = sessionState.decorationsByRevision.get(binding.revisionIndex);
      if (!decorations) {
        continue;
      }

      const mappedDecorations = mapRevisionDecorationsToDocumentLines(decorations, binding.projectedLineMap);
      editor.setDecorations(this.previousPairEdgeType!, mappedDecorations.previousPairEdges);
      editor.setDecorations(this.nextPairEdgeType!, mappedDecorations.nextPairEdges);
      editor.setDecorations(this.addedLineType!, mappedDecorations.addedLines);
      editor.setDecorations(this.removedLineType!, mappedDecorations.removedLines);
      editor.setDecorations(this.modifiedLineType!, mappedDecorations.modifiedLines);
      editor.setDecorations(this.addedTextType!, mappedDecorations.addedText);
      editor.setDecorations(this.removedTextType!, mappedDecorations.removedText);
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

  private collectVisibleSessionStates(): Map<string, VisibleSessionDecorationState> {
    const sessionIds = new Set<string>();
    for (const editor of vscode.window.visibleTextEditors) {
      const binding = this.sessionService.getSessionFileBinding(editor.document.uri);
      if (binding?.lineNumberSpace === 'globalRow') {
        sessionIds.add(binding.sessionId);
      }
    }

    const visibleSessionStates = new Map<string, VisibleSessionDecorationState>();
    for (const sessionId of sessionIds) {
      const session = this.sessionService.getBrowserSession(sessionId);
      if (!session || session.surfaceMode !== 'native') {
        continue;
      }

      const viewport = buildSessionViewport(
        session,
        this.sessionService.getSessionViewState(session.id),
        this.sessionService.getRowProjectionState(session.id)
      );
      visibleSessionStates.set(sessionId, {
        windowStart: viewport.visibleWindow.startRevisionIndex,
        decorationsByRevision: buildRevisionDecorationModelsForViewport(
          session,
          viewport.visiblePairs,
          viewport.activePair
        )
      });
    }

    return visibleSessionStates;
  }
}

export function buildRevisionDecorationModels(
  session: NWayCompareSession,
  startRevisionIndex: number,
  endRevisionIndex: number,
  activePairKey: string | undefined
): Map<number, RevisionDecorations> {
  const visiblePairs = getVisiblePairOverlays(session, {
    startRevisionIndex,
    endRevisionIndex,
    rawSnapshots: session.rawSnapshots.slice(startRevisionIndex, endRevisionIndex + 1)
  });
  const activePair = activePairKey ? getPairOverlay(session, activePairKey) : undefined;

  return buildRevisionDecorationModelsForViewport(session, visiblePairs, activePair);
}

export function buildRevisionDecorationModelsForViewport(
  session: NWayCompareSession,
  visiblePairs: readonly ComparePairOverlay[],
  activePair: ComparePairOverlay | undefined
): Map<number, RevisionDecorations> {
  const decorationsByRevision = new Map<number, RevisionDecorations>();
  const changedRowNumbers = [...new Set(visiblePairs.flatMap((pair) => pair.changedRowNumbers))];
  for (const rowNumber of changedRowNumbers) {
    collectRowDecorations(
      buildCompareRowDisplayState(session, rowNumber, visiblePairs, activePair),
      decorationsByRevision
    );
  }

  return decorationsByRevision;
}

function collectRowDecorations(
  rowDisplayState: CompareRowDisplayState,
  decorationsByRevision: Map<number, RevisionDecorations>
): void {
  for (const cellState of rowDisplayState.cells) {
    const decorations = getOrCreateDecorations(decorationsByRevision, cellState.revisionIndex);
    if (cellState.hasNextPairEdge) {
      pushWholeLineDecoration(decorations.nextPairEdges, rowDisplayState.rowNumber);
    }
    if (cellState.hasPreviousPairEdge) {
      pushWholeLineDecoration(decorations.previousPairEdges, rowDisplayState.rowNumber);
    }

    switch (cellState.activeChangeKind) {
      case 'added':
        pushWholeLineDecoration(decorations.addedLines, rowDisplayState.rowNumber);
        break;
      case 'removed':
        pushWholeLineDecoration(decorations.removedLines, rowDisplayState.rowNumber);
        break;
      case 'modified':
        pushWholeLineDecoration(decorations.modifiedLines, rowDisplayState.rowNumber);
        pushIntralineDecorations(
          cellState.activeSegmentKind === 'removed' ? decorations.removedText : decorations.addedText,
          rowDisplayState.rowNumber,
          cellState.activeIntralineSegments
        );
        break;
      default:
        break;
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

function pushWholeLineDecoration(target: vscode.DecorationOptions[], lineNumber: number): void {
  if (target.some((entry) => entry.range.start.line === lineNumber - 1)) {
    return;
  }

  target.push(toWholeLineDecoration(lineNumber));
}

export function mapRevisionDecorationsToDocumentLines(
  decorations: RevisionDecorations,
  projectedLineMap: SessionProjectedLineMap | undefined
): RevisionDecorations {
  if (!projectedLineMap) {
    return decorations;
  }

  return {
    previousPairEdges: mapDecorationOptions(decorations.previousPairEdges, projectedLineMap),
    nextPairEdges: mapDecorationOptions(decorations.nextPairEdges, projectedLineMap),
    addedLines: mapDecorationOptions(decorations.addedLines, projectedLineMap),
    removedLines: mapDecorationOptions(decorations.removedLines, projectedLineMap),
    modifiedLines: mapDecorationOptions(decorations.modifiedLines, projectedLineMap),
    addedText: mapDecorationOptions(decorations.addedText, projectedLineMap),
    removedText: mapDecorationOptions(decorations.removedText, projectedLineMap)
  };
}

function mapDecorationOptions(
  decorations: readonly vscode.DecorationOptions[],
  projectedLineMap: SessionProjectedLineMap
): vscode.DecorationOptions[] {
  return decorations.flatMap((decoration) => {
    const documentLineNumber = projectedLineMap.globalRowToDocumentLine.get(decoration.range.start.line + 1);
    if (documentLineNumber === undefined) {
      return [];
    }

    const startCharacter = decoration.range.start.character;
    const endCharacter = decoration.range.end.character;
    return [{
      ...decoration,
      range: new vscode.Range(
        documentLineNumber - 1,
        startCharacter,
        documentLineNumber - 1,
        endCharacter
      )
    }];
  });
}
