import * as vscode from 'vscode';

import { LanguageFeatureCompatibilityService } from '../application/languageFeatureCompatibilityService';

export class HoverBridgeProvider implements vscode.HoverProvider {
  public constructor(private readonly compatibilityService: LanguageFeatureCompatibilityService) {}

  public provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Thenable<vscode.Hover | undefined> {
    void document;
    void position;
    void token;
    return this.compatibilityService.provideHoverFallback();
  }
}
