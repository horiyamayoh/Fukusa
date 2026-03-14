import { RepoContext } from '../../adapters/common/types';

export interface CacheKeyDescriptor {
  readonly key: string;
  readonly namespace: 'snapshot' | 'history' | 'blame' | 'diff';
  readonly repoId: string;
  readonly relativePath: string;
}

export function toRepoCacheId(repo: RepoContext): string {
  return `${repo.kind}:${repo.repoId}`;
}

function buildKey(namespace: CacheKeyDescriptor['namespace'], repo: RepoContext, relativePath: string, suffix: string): CacheKeyDescriptor {
  const normalizedPath = relativePath.replace(/\\/g, '/');
  return {
    key: [namespace, toRepoCacheId(repo), normalizedPath, suffix].join('|'),
    namespace,
    repoId: toRepoCacheId(repo),
    relativePath: normalizedPath
  };
}

export function createSnapshotCacheKey(repo: RepoContext, relativePath: string, revision: string): CacheKeyDescriptor {
  return buildKey('snapshot', repo, relativePath, revision);
}

export function createHistoryCacheKey(repo: RepoContext, relativePath: string, limit: number): CacheKeyDescriptor {
  return buildKey('history', repo, relativePath, String(limit));
}

export function createBlameCacheKey(repo: RepoContext, relativePath: string, revision?: string): CacheKeyDescriptor {
  return buildKey('blame', repo, relativePath, revision ?? 'WORKTREE');
}

export function createDiffCacheKey(
  repo: RepoContext,
  relativePath: string,
  leftRevision: string,
  rightRevision: string
): CacheKeyDescriptor {
  return buildKey('diff', repo, relativePath, `${leftRevision}..${rightRevision}`);
}
