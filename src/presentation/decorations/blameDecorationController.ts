import * as vscode from 'vscode';

import { BlameHeatmapLine, BlameService } from '../../application/blameService';
import { SessionService } from '../../application/sessionService';
import { getBlameShowOverviewRuler } from '../../configuration/extensionConfiguration';
import { OutputLogger } from '../../util/output';

const darkPalette = ['rgba(40,167,69,0.18)', 'rgba(155,200,83,0.18)', 'rgba(255,193,7,0.18)', 'rgba(255,128,0,0.18)', 'rgba(220,53,69,0.22)'];
const lightPalette = ['rgba(40,167,69,0.10)', 'rgba(155,200,83,0.12)', 'rgba(255,193,7,0.14)', 'rgba(255,128,0,0.16)', 'rgba(220,53,69,0.18)'];
const highContrastPalette = ['rgba(0,255,0,0.22)', 'rgba(173,255,47,0.24)', 'rgba(255,255,0,0.24)', 'rgba(255,140,0,0.24)', 'rgba(255,0,0,0.28)'];

export class BlameDecorationController implements vscode.Disposable {
  private enabled = false;
  private readonly types: vscode.TextEditorDecorationType[] = [];
  private readonly decoratedEditors = new Set<vscode.TextEditor>();
  private readonly disposables: vscode.Disposable[] = [];

  public constructor(
    private readonly blameService: BlameService,
    private readonly sessionService: SessionService,
    private readonly output: OutputLogger
  ) {
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(() => {
        if (this.enabled) {
          void this.refreshVisibleEditors();
        }
      }),
      vscode.window.onDidChangeVisibleTextEditors(() => {
        if (this.enabled) {
          void this.refreshVisibleEditors();
        }
      }),
      vscode.window.onDidChangeActiveColorTheme(() => {
        if (this.enabled) {
          this.recreateDecorationTypes();
          void this.refreshVisibleEditors();
        }
      })
    );
    this.recreateDecorationTypes();
  }

  public async toggle(): Promise<boolean> {
    this.enabled = !this.enabled;
    if (!this.enabled) {
      this.clearDecoratedEditors();
      return false;
    }

    await this.refreshVisibleEditors();
    return true;
  }

  public dispose(): void {
    this.clearDecoratedEditors();
    for (const type of this.types) {
      type.dispose();
    }
    while (this.disposables.length > 0) {
      this.disposables.pop()?.dispose();
    }
  }

  private async update(editor: vscode.TextEditor | undefined): Promise<void> {
    if (!editor) {
      return;
    }

    if (!['file', 'multidiff', 'multidiff-session-doc'].includes(editor.document.uri.scheme)) {
      this.clear(editor);
      return;
    }

    const heatmap = this.getSessionHeatmap(editor) ?? await this.blameService.getHeatmap(editor.document.uri);
    if (!heatmap) {
      this.clear(editor);
      return;
    }

    const grouped = new Map<number, vscode.DecorationOptions[]>();
    for (const line of heatmap.lines) {
      const options = grouped.get(line.ageBucket) ?? [];
      options.push(this.toDecoration(line));
      grouped.set(line.ageBucket, options);
    }

    this.types.forEach((type, index) => {
      editor.setDecorations(type, grouped.get(index) ?? []);
    });
    this.decoratedEditors.add(editor);

    this.output.info(`Applied blame heatmap to ${editor.document.uri.toString()}`);
  }

  private clear(editor: vscode.TextEditor | undefined): void {
    if (!editor) {
      return;
    }

    for (const type of this.types) {
      editor.setDecorations(type, []);
    }
    this.decoratedEditors.delete(editor);
  }

  private clearDecoratedEditors(): void {
    const editorsToClear = new Set<vscode.TextEditor>([
      ...this.decoratedEditors,
      ...vscode.window.visibleTextEditors
    ]);
    for (const editor of editorsToClear) {
      this.clear(editor);
    }
  }

  private async refreshVisibleEditors(): Promise<void> {
    const visibleEditors = vscode.window.visibleTextEditors;
    const visibleEditorSet = new Set(visibleEditors);

    for (const editor of [...this.decoratedEditors]) {
      if (!visibleEditorSet.has(editor)) {
        this.clear(editor);
      }
    }

    await Promise.all(visibleEditors.map((editor) => this.update(editor)));
  }

  private recreateDecorationTypes(): void {
    while (this.types.length > 0) {
      this.types.pop()?.dispose();
    }

    const palette = selectPalette(vscode.window.activeColorTheme.kind);
    const showOverviewRuler = getBlameShowOverviewRuler();
    for (const color of palette) {
      this.types.push(vscode.window.createTextEditorDecorationType({
        isWholeLine: true,
        backgroundColor: color,
        overviewRulerColor: showOverviewRuler ? color : undefined,
        overviewRulerLane: vscode.OverviewRulerLane.Left
      }));
    }
  }

  private toDecoration(line: BlameHeatmapLine): vscode.DecorationOptions {
    const range = new vscode.Range(line.lineNumber - 1, 0, line.lineNumber - 1, 0);
    const hover = new vscode.MarkdownString(
      `**${line.author || 'unknown'}**  \n${line.revision.slice(0, 12)}  \n${line.timestamp ? new Date(line.timestamp).toLocaleString() : 'Unknown date'}  \n${line.summary ?? ''}`
    );
    hover.isTrusted = false;
    return {
      range,
      hoverMessage: hover
    };
  }

  private getSessionHeatmap(editor: vscode.TextEditor): { readonly lines: readonly BlameHeatmapLine[] } | undefined {
    const binding = this.sessionService.getSessionFileBinding(editor.document.uri);
    if (!binding) {
      return undefined;
    }

    const session = this.sessionService.getBrowserSession(binding.sessionId);
    if (!session) {
      return undefined;
    }

    const snapshot = session.rawSnapshots[binding.revisionIndex];
    return {
      lines: session.globalRows.flatMap((row) => {
        const cell = row.cells[binding.revisionIndex];
        if (cell.blameAgeBucket === undefined) {
          return [];
        }

        const lineNumber = binding.lineNumberSpace === 'globalRow'
          ? binding.projectedLineMap
            ? binding.projectedLineMap.globalRowToDocumentLine.get(row.rowNumber)
            : row.rowNumber
          : cell.originalLineNumber;
        if (lineNumber === undefined) {
          return [];
        }

        return {
          lineNumber,
          ageBucket: cell.blameAgeBucket,
          revision: cell.blameInfo?.revision ?? snapshot.revisionId,
          author: cell.blameInfo?.author ?? snapshot.revisionLabel,
          summary: cell.blameInfo?.summary ?? snapshot.relativePath,
          timestamp: cell.blameInfo?.timestamp
        };
      })
    };
  }
}

function selectPalette(kind: vscode.ColorThemeKind): readonly string[] {
  if (kind === vscode.ColorThemeKind.HighContrast || kind === vscode.ColorThemeKind.HighContrastLight) {
    return highContrastPalette;
  }

  return kind === vscode.ColorThemeKind.Light ? lightPalette : darkPalette;
}
