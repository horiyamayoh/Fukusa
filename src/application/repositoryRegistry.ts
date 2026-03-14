import { RepoContext, RepositoryKind } from '../adapters/common/types';

export class RepositoryRegistry {
  private readonly repos = new Map<string, RepoContext>();

  public register(repo: RepoContext): void {
    this.repos.set(this.toKey(repo.kind, repo.repoId), repo);
  }

  public get(kind: RepositoryKind, repoId: string): RepoContext | undefined {
    return this.repos.get(this.toKey(kind, repoId));
  }

  public clear(): void {
    this.repos.clear();
  }

  private toKey(kind: RepositoryKind, repoId: string): string {
    return `${kind}:${repoId}`;
  }
}
