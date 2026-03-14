import * as vscode from 'vscode';

import { BlameHeatmapLine, BlameService } from '../../application/blameService';
import { OutputLogger } from '../../util/output';

const darkPalette = ['rgba(40,167,69,0.18)', 'rgba(155,200,83,0.18)', 'rgba(255,193,7,0.18)', 'rgba(255,128,0,0.18)', 'rgba(220,53,69,0.22)'];
const lightPalette = ['rgba(40,167,69,0.10)', 'rgba(155,200,83,0.12)', 'rgba(255,193,7,0.14)', 'rgba(255,128,0,0.16)', 'rgba(220,53,69,0.18)'];
const highContrastPalette = ['rgba(0,255,0,0.22)', 'rgba(173,255,47,0.24)', 'rgba(255,255,0,0.24)', 'rgba(255,140,0,0.24)', 'rgba(255,0,0,0.28)'];

export class BlameDecorationController implements vscode.Disposable {
  private enabled = false;
  private readonly types: vscode.TextEditorDecorationType[] = [];
  private readonly disposables: vscode.Disposable[] = [];

  public constructor(private readonly blameService: BlameService, private readonly output: OutputLogger) {
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (this.enabled) {
          void this.update(editor);
        }
      }),
      vscode.window.onDidChangeActiveColorTheme(() => {
        if (this.enabled) {
          this.recreateDecorationTypes();
          void this.update(vscode.window.activeTextEditor);
        }
      })
    );
    this.recreateDecorationTypes();
  }

  public async toggle(): Promise<boolean> {
    this.enabled = !this.enabled;
    if (!this.enabled) {
      this.clear(vscode.window.activeTextEditor);
      return false;
    }

    await this.update(vscode.window.activeTextEditor);
    return true;
  }

  public dispose(): void {
    this.clear(vscode.window.activeTextEditor);
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

    if (!['file', 'multidiff'].includes(editor.document.uri.scheme)) {
      this.clear(editor);
      return;
    }

    const heatmap = await this.blameService.getHeatmap(editor.document.uri);
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

    this.output.info(`Applied blame heatmap to ${editor.document.uri.toString()}`);
  }

  private clear(editor: vscode.TextEditor | undefined): void {
    if (!editor) {
      return;
    }

    for (const type of this.types) {
      editor.setDecorations(type, []);
    }
  }

  private recreateDecorationTypes(): void {
    while (this.types.length > 0) {
      this.types.pop()?.dispose();
    }

    const palette = selectPalette(vscode.window.activeColorTheme.kind);
    const showOverviewRuler = vscode.workspace.getConfiguration('multidiff').get<boolean>('blame.showOverviewRuler', true);
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
}

function selectPalette(kind: vscode.ColorThemeKind): readonly string[] {
  if (kind === vscode.ColorThemeKind.HighContrast || kind === vscode.ColorThemeKind.HighContrastLight) {
    return highContrastPalette;
  }

  return kind === vscode.ColorThemeKind.Light ? lightPalette : darkPalette;
}
