import * as vscode from 'vscode';

import { TempSnapshotMirror } from '../infrastructure/temp/tempSnapshotMirror';

export class LanguageFeatureCompatibilityService implements vscode.Disposable {
  public constructor(private readonly tempSnapshotMirror: TempSnapshotMirror) {}

  public async resolveSnapshotUri(uri: vscode.Uri): Promise<vscode.Uri> {
    if (uri.scheme !== 'multidiff') {
      return uri;
    }

    const openMode = vscode.workspace.getConfiguration('multidiff').get<string>('snapshot.openMode', 'virtual');
    if (openMode === 'tempFile') {
      return this.tempSnapshotMirror.mirror(uri);
    }

    return uri;
  }

  public async openSnapshotAsTemp(uri: vscode.Uri): Promise<vscode.TextEditor> {
    const tempUri = await this.tempSnapshotMirror.mirror(uri);
    const document = await vscode.workspace.openTextDocument(tempUri);
    return vscode.window.showTextDocument(document, { preview: false });
  }

  public async provideDefinitionFallback(): Promise<vscode.Definition | undefined> {
    return undefined;
  }

  public async provideHoverFallback(): Promise<vscode.Hover | undefined> {
    return undefined;
  }

  public async provideReferencesFallback(): Promise<vscode.Location[] | undefined> {
    return undefined;
  }

  public dispose(): void {
    this.tempSnapshotMirror.dispose();
  }
}
