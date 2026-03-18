import { RepoContext } from '../../adapters/common/types';

export interface CacheKeyDescriptor {
  readonly key: string;
  readonly namespace: 'snapshot' | 'history' | 'blame' | 'diff' | 'shadowTree' | 'alignment' | 'alignedText';
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

export function createShadowTreeCacheKey(repo: RepoContext, revision: string): CacheKeyDescriptor {
  return buildKey('shadowTree', repo, '.', revision);
}

export function createAlignmentCacheKey(repo: RepoContext, relativePath: string, revisions: readonly string[]): CacheKeyDescriptor {
  return buildKey('alignment', repo, relativePath, revisions.join('..'));
}

export function createAlignedTextCacheKey(repo: RepoContext, relativePath: string, revision: string, sessionId: string): CacheKeyDescriptor {
  return buildKey('alignedText', repo, relativePath, `${sessionId}:${revision}`);
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
