import * as vscode from 'vscode';

export class HistoricalLanguageFeatureService
  implements vscode.Disposable, vscode.DefinitionProvider, vscode.HoverProvider, vscode.ReferenceProvider
{
  public provideDefinition(): Thenable<vscode.Definition | vscode.DefinitionLink[] | undefined> {
    return Promise.resolve(undefined);
  }

  public provideHover(): Thenable<vscode.Hover | undefined> {
    return Promise.resolve(undefined);
  }

  public provideReferences(): Thenable<vscode.Location[] | undefined> {
    return Promise.resolve(undefined);
  }

  public dispose(): void {
    // Compare panel v1 does not bridge language features.
  }
}
