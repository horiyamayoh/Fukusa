import * as vscode from 'vscode';

export interface BuiltInGitRepository {
  readonly rootUri: vscode.Uri;
}

export interface BuiltInGitApi {
  getRepository(uri: vscode.Uri): BuiltInGitRepository | null;
}

interface BuiltInGitExports {
  getAPI(version: number): BuiltInGitApi;
}

export class GitApiService {
  public getRepositoryRoot(uri: vscode.Uri): string | undefined {
    const extension = vscode.extensions.getExtension<BuiltInGitExports>('vscode.git');
    if (!extension) {
      return undefined;
    }

    if (!extension.isActive) {
      void extension.activate();
    }

    const repository = extension.exports.getAPI(1).getRepository(uri);
    return repository?.rootUri.fsPath;
  }
}
