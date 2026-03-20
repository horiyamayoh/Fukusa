import * as path from 'path';
import * as vscode from 'vscode';

import {
  AdjacentPairOverlay,
  ComparePairProjection,
  CompareSurfaceMode,
  GlobalRow,
  NWayCompareSession,
  RepoContext,
  RevisionRef,
  SessionFileBinding,
  SessionProjectedLineMap
} from '../../adapters/common/types';
import { createProjectedLineMap } from '../../application/sessionRowProjection';
import { RepositoryRegistry } from '../../application/repositoryRegistry';
import { UriFactory } from '../../infrastructure/fs/uriFactory';

const DEFAULT_REPO: RepoContext = {
  kind: 'git',
  repoRoot: 'c:/repo',
  repoId: 'repo123'
};

const DEFAULT_RELATIVE_PATH = 'src/sample.ts';
const DEFAULT_PAIR_PROJECTION: ComparePairProjection = {
  mode: 'adjacent'
};

export interface CreateSessionOptions {
  readonly repo?: Partial<RepoContext>;
  readonly relativePath?: string;
  readonly createdAt?: number;
  readonly rowCount?: number;
  readonly changedRowNumbers?: readonly number[];
  readonly pairProjection?: ComparePairProjection;
  readonly surfaceMode?: CompareSurfaceMode;
  readonly globalRows?: readonly GlobalRow[];
  readonly adjacentPairs?: readonly AdjacentPairOverlay[];
  readonly originalUri?: vscode.Uri;
}

export interface CreateSessionBindingsOptions {
  readonly lineNumberSpace?: 'original' | 'globalRow';
  readonly windowStart?: number;
  readonly projectedGlobalRows?: readonly number[];
  readonly projectedLineMap?: SessionProjectedLineMap;
}

export function createRevisions(count: number, shortLabelPrefix = 'r'): RevisionRef[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `rev-${index}`,
    shortLabel: `${shortLabelPrefix}${index}`
  }));
}

export function createSession(
  sessionId: string,
  revisions: readonly RevisionRef[],
  options?: CreateSessionOptions
): NWayCompareSession;
export function createSession(
  sessionId: string,
  revisions: readonly RevisionRef[],
  surfaceMode: CompareSurfaceMode,
  options?: CreateSessionOptions
): NWayCompareSession;
export function createSession(
  sessionId: string,
  revisions: readonly RevisionRef[],
  optionsOrSurfaceMode: CreateSessionOptions | CompareSurfaceMode = {},
  maybeOptions: CreateSessionOptions = {}
): NWayCompareSession {
  const options = typeof optionsOrSurfaceMode === 'string'
    ? {
        ...maybeOptions,
        surfaceMode: optionsOrSurfaceMode
      }
    : optionsOrSurfaceMode;
  const repo = createRepoContext(options.repo);
  const relativePath = options.relativePath ?? DEFAULT_RELATIVE_PATH;
  const rowCount = Math.max(1, options.rowCount ?? options.globalRows?.length ?? 1);
  const pairProjection = options.pairProjection ?? DEFAULT_PAIR_PROJECTION;
  const globalRows = options.globalRows ?? createGlobalRows(revisions, rowCount);
  const adjacentPairs = options.adjacentPairs ?? createAdjacentPairs(revisions, options.changedRowNumbers ?? [1]);
  const uriFactory = new UriFactory(new RepositoryRegistry());

  return {
    id: sessionId,
    uri: uriFactory.createSessionUri(sessionId, relativePath),
    repo,
    originalUri: options.originalUri ?? vscode.Uri.file(path.join(repo.repoRoot, relativePath)),
    relativePath,
    revisions,
    createdAt: options.createdAt ?? Date.now(),
    rowCount,
    rawSnapshots: createRawSnapshots(revisions, repo, relativePath, rowCount),
    globalRows,
    adjacentPairs,
    pairProjection,
    surfaceMode: options.surfaceMode ?? 'native'
  };
}

export function createSessionBindings(
  session: Pick<NWayCompareSession, 'id' | 'rawSnapshots'>,
  options: CreateSessionBindingsOptions = {}
): SessionFileBinding[] {
  const lineNumberSpace = options.lineNumberSpace ?? 'globalRow';
  const windowStart = options.windowStart ?? 0;
  const projectedGlobalRows = options.projectedGlobalRows;
  const projectedLineMap = options.projectedLineMap ?? (
    projectedGlobalRows ? createProjectedLineMap(projectedGlobalRows) : undefined
  );
  const uriFactory = new UriFactory(new RepositoryRegistry());

  return session.rawSnapshots.map((snapshot) => ({
    sessionId: session.id,
    revisionIndex: snapshot.revisionIndex,
    revisionId: snapshot.revisionId,
    relativePath: snapshot.relativePath,
    rawUri: snapshot.rawUri,
    documentUri: lineNumberSpace === 'globalRow'
      ? uriFactory.createSessionDocumentUri(
          session.id,
          windowStart,
          snapshot.revisionIndex,
          snapshot.relativePath,
          snapshot.revisionLabel
        )
      : snapshot.rawUri,
    lineNumberSpace,
    windowStart: lineNumberSpace === 'globalRow' ? windowStart : undefined,
    projectedGlobalRows,
    projectedLineMap
  }));
}

function createRepoContext(repo?: Partial<RepoContext>): RepoContext {
  return {
    ...DEFAULT_REPO,
    ...repo
  };
}

function createRawSnapshots(
  revisions: readonly RevisionRef[],
  repo: RepoContext,
  relativePath: string,
  rowCount: number
): NWayCompareSession['rawSnapshots'] {
  return revisions.map((revision, index) => {
    const snapshotPath = path.join(repo.repoRoot, '.fukusa-shadow', 'revisions', revision.id, relativePath);
    return {
      snapshotUri: vscode.Uri.file(snapshotPath),
      rawUri: vscode.Uri.file(snapshotPath),
      revisionIndex: index,
      revisionId: revision.id,
      revisionLabel: revision.shortLabel,
      relativePath,
      lineMap: createIdentityLineMap(rowCount)
    };
  });
}

function createGlobalRows(revisions: readonly RevisionRef[], rowCount: number): GlobalRow[] {
  return Array.from({ length: rowCount }, (_, rowIndex) => ({
    rowNumber: rowIndex + 1,
    cells: revisions.map((revision, revisionIndex) => ({
      revisionIndex,
      rowNumber: rowIndex + 1,
      present: true,
      text: `${revision.id}-${rowIndex + 1}`,
      originalLineNumber: rowIndex + 1
    }))
  }));
}

function createAdjacentPairs(revisions: readonly RevisionRef[], changedRowNumbers: readonly number[]): AdjacentPairOverlay[] {
  return revisions.slice(0, -1).map((revision, index) => ({
    key: `${index}:${index + 1}`,
    leftRevisionIndex: index,
    rightRevisionIndex: index + 1,
    label: `${revision.shortLabel}-${revisions[index + 1].shortLabel}`,
    changedRowNumbers
  }));
}

function createIdentityLineMap(rowCount: number): NWayCompareSession['rawSnapshots'][number]['lineMap'] {
  const rowToOriginalLine = new Map<number, number>();
  const originalLineToRow = new Map<number, number>();

  for (let line = 1; line <= rowCount; line += 1) {
    rowToOriginalLine.set(line, line);
    originalLineToRow.set(line, line);
  }

  return {
    rowToOriginalLine,
    originalLineToRow
  };
}
