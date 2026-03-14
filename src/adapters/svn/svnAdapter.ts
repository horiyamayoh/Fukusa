import * as vscode from 'vscode';

import { stableHash } from '../../util/hash';
import { OutputLogger } from '../../util/output';
import { IRepositoryAdapter } from '../common/repositoryAdapter';
import { BlameLineInfo, RepoContext, RepositoryKind, RevisionRef } from '../common/types';
import { SvnCli } from './svnCli';

export class SvnAdapter implements IRepositoryAdapter {
  public readonly kind: RepositoryKind = 'svn';

  public constructor(private readonly svnCli: SvnCli, private readonly output: OutputLogger) {}

  public async resolveRepoContext(uri: vscode.Uri): Promise<RepoContext | undefined> {
    const repoRoot = await this.svnCli.resolveRepoRoot(uri.fsPath);
    if (!repoRoot) {
      return undefined;
    }

    const repo: RepoContext = {
      kind: 'svn',
      repoRoot,
      repoId: stableHash(repoRoot)
    };
    this.output.info(`Resolved SVN repository: ${repoRoot}`);
    return repo;
  }

  public getHistory(repo: RepoContext, relativePath: string, limit: number): Promise<RevisionRef[]> {
    return this.svnCli.getHistory(repo.repoRoot, relativePath, limit);
  }

  public getSnapshot(repo: RepoContext, relativePath: string, revision: string): Promise<Uint8Array> {
    return this.svnCli.getSnapshot(repo.repoRoot, relativePath, revision);
  }

  public getBlame(repo: RepoContext, relativePath: string, revision?: string): Promise<BlameLineInfo[]> {
    return this.svnCli.getBlame(repo.repoRoot, relativePath, revision);
  }

  public getDiff(repo: RepoContext, relativePath: string, leftRevision: string, rightRevision: string): Promise<string> {
    return this.svnCli.getDiff(repo.repoRoot, relativePath, leftRevision, rightRevision);
  }
}
