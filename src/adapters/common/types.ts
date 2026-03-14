import * as vscode from 'vscode';

export type RepositoryKind = 'git' | 'svn';
export type SessionMode = 'adjacent' | 'base';
export type CacheValueKind = 'binary' | 'json';

export interface RepoContext {
  readonly kind: RepositoryKind;
  readonly repoRoot: string;
  readonly repoId: string;
}

export interface RevisionRef {
  readonly id: string;
  readonly shortLabel: string;
  readonly author?: string;
  readonly email?: string;
  readonly message?: string;
  readonly timestamp?: number;
}

export interface SnapshotResource {
  readonly repo: RepoContext;
  readonly relativePath: string;
  readonly revision: string;
  readonly uri: vscode.Uri;
  readonly title: string;
}

export interface DiffPair {
  readonly left: SnapshotResource;
  readonly right: SnapshotResource;
  readonly title: string;
}

export interface MultiDiffSession {
  readonly id: string;
  readonly repo: RepoContext;
  readonly originalUri: vscode.Uri;
  readonly relativePath: string;
  readonly revisions: readonly RevisionRef[];
  readonly pairs: readonly DiffPair[];
  readonly mode: SessionMode;
  readonly createdAt: number;
  visiblePairCount: number;
  visibleStartPairIndex: number;
}

export interface BlameLineInfo {
  readonly lineNumber: number;
  readonly revision: string;
  readonly author: string;
  readonly email?: string;
  readonly summary?: string;
  readonly timestamp?: number;
}

export interface ParsedSnapshotUri {
  readonly kind: RepositoryKind;
  readonly repoId: string;
  readonly relativePath: string;
  readonly displayRelativePath: string;
  readonly revision: string;
}

export interface ResolvedResource {
  readonly repo: RepoContext;
  readonly relativePath: string;
  readonly originalUri: vscode.Uri;
  readonly revision?: string;
}

export interface CacheEntryMetadata {
  readonly key: string;
  readonly namespace: string;
  readonly repoId: string;
  readonly relativePath: string;
  readonly size: number;
  readonly updatedAt: number;
}

export interface CacheOverviewItem {
  readonly repoId: string;
  readonly size: number;
  readonly entryCount: number;
  readonly namespaces: ReadonlyMap<string, number>;
}
