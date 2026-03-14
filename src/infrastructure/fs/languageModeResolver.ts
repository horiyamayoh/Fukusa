import * as path from 'path';
import * as vscode from 'vscode';

import { UriFactory } from './uriFactory';

const extensionToLanguage = new Map<string, string>([
  ['.ts', 'typescript'],
  ['.tsx', 'typescriptreact'],
  ['.js', 'javascript'],
  ['.jsx', 'javascriptreact'],
  ['.json', 'json'],
  ['.jsonc', 'jsonc'],
  ['.md', 'markdown'],
  ['.py', 'python'],
  ['.java', 'java'],
  ['.cs', 'csharp'],
  ['.cpp', 'cpp'],
  ['.cc', 'cpp'],
  ['.c', 'c'],
  ['.h', 'c'],
  ['.hpp', 'cpp'],
  ['.go', 'go'],
  ['.rs', 'rust'],
  ['.rb', 'ruby'],
  ['.php', 'php'],
  ['.xml', 'xml'],
  ['.yml', 'yaml'],
  ['.yaml', 'yaml'],
  ['.html', 'html'],
  ['.css', 'css'],
  ['.scss', 'scss'],
  ['.sh', 'shellscript']
]);

export class LanguageModeResolver implements vscode.Disposable {
  private readonly disposable: vscode.Disposable;

  public constructor(private readonly uriFactory: UriFactory) {
    this.disposable = vscode.workspace.onDidOpenTextDocument((document) => {
      void this.apply(document);
    });
  }

  public dispose(): void {
    this.disposable.dispose();
  }

  public async apply(document: vscode.TextDocument): Promise<void> {
    if (document.uri.scheme !== 'multidiff' || document.languageId !== 'plaintext') {
      return;
    }

    const parsed = this.uriFactory.parseSnapshotUri(document.uri);
    const extension = path.posix.extname(parsed.relativePath).toLowerCase();
    const languageId = extensionToLanguage.get(extension);
    if (!languageId) {
      return;
    }

    await vscode.languages.setTextDocumentLanguage(document, languageId);
  }
}
