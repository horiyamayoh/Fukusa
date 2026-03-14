import * as vscode from 'vscode';

import {
  BlameLineInfo,
  RepoContext,
  RepositoryKind,
  RevisionRef
} from './types';

export interface IRepositoryAdapter {
  readonly kind: RepositoryKind;

  resolveRepoContext(uri: vscode.Uri): Promise<RepoContext | undefined>;
  getHistory(repo: RepoContext, relativePath: string, limit: number): Promise<RevisionRef[]>;
  getSnapshot(repo: RepoContext, relativePath: string, revision: string): Promise<Uint8Array>;
  getBlame(repo: RepoContext, relativePath: string, revision?: string): Promise<BlameLineInfo[]>;
  getDiff(repo: RepoContext, relativePath: string, leftRevision: string, rightRevision: string): Promise<string>;
}
