import * as vscode from 'vscode';

import { LanguageFeatureCompatibilityService } from '../application/languageFeatureCompatibilityService';

export class DefinitionBridgeProvider implements vscode.DefinitionProvider {
  public constructor(private readonly compatibilityService: LanguageFeatureCompatibilityService) {}

  public provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Thenable<vscode.Definition | undefined> {
    void document;
    void position;
    void token;
    return this.compatibilityService.provideDefinitionFallback();
  }
}
