import * as vscode from 'vscode';

import { LanguageFeatureCompatibilityService } from '../application/languageFeatureCompatibilityService';

export class ReferenceBridgeProvider implements vscode.ReferenceProvider {
  public constructor(private readonly compatibilityService: LanguageFeatureCompatibilityService) {}

  public provideReferences(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.ReferenceContext,
    token: vscode.CancellationToken
  ): Thenable<vscode.Location[] | undefined> {
    void document;
    void position;
    void context;
    void token;
    return this.compatibilityService.provideReferencesFallback();
  }
}
