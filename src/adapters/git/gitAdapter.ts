import * as vscode from 'vscode';

import { stableHash } from '../../util/hash';
import { OutputLogger } from '../../util/output';
import { IRepositoryAdapter } from '../common/repositoryAdapter';
import { BlameLineInfo, RepoContext, RepositoryKind, RevisionRef } from '../common/types';
import { GitApiService } from './gitApi';
import { GitCli } from './gitCli';

export class GitAdapter implements IRepositoryAdapter {
  public readonly kind: RepositoryKind = 'git';

  public constructor(
    private readonly gitApi: GitApiService,
    private readonly gitCli: GitCli,
    private readonly output: OutputLogger
  ) {}

  public async resolveRepoContext(uri: vscode.Uri): Promise<RepoContext | undefined> {
    const root = this.gitApi.getRepositoryRoot(uri) ?? (await this.gitCli.resolveRepoRoot(uri.fsPath));
    if (!root) {
      return undefined;
    }

    const repo: RepoContext = {
      kind: 'git',
      repoRoot: root,
      repoId: stableHash(root)
    };
    this.output.info(`Resolved Git repository: ${root}`);
    return repo;
  }

  public getHistory(repo: RepoContext, relativePath: string, limit: number): Promise<RevisionRef[]> {
    return this.gitCli.getHistory(repo.repoRoot, relativePath, limit);
  }

  public getSnapshot(repo: RepoContext, relativePath: string, revision: string): Promise<Uint8Array> {
    return this.gitCli.getSnapshot(repo.repoRoot, relativePath, revision);
  }

  public getBlame(repo: RepoContext, relativePath: string, revision?: string): Promise<BlameLineInfo[]> {
    return this.gitCli.getBlame(repo.repoRoot, relativePath, revision);
  }

  public getDiff(repo: RepoContext, relativePath: string, leftRevision: string, rightRevision: string): Promise<string> {
    return this.gitCli.getDiff(repo.repoRoot, relativePath, leftRevision, rightRevision);
  }

  public materializeRevisionTree(repo: RepoContext, revision: string, targetRoot: string): Promise<void> {
    return this.gitCli.materializeRevisionTree(repo.repoRoot, revision, targetRoot);
  }
}
