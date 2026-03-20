import * as vscode from 'vscode';

/** Supported repository backends. */
export type RepositoryKind = 'git' | 'svn';
/** Cached value storage format. */
export type CacheValueKind = 'binary' | 'json';
/** Per-cell change classification used by aligned rows. */
export type CompareChangeKind = 'added' | 'removed' | 'modified';
/** Available projection strategies for N-way pair overlays. */
export type ComparePairProjectionMode = 'adjacent' | 'base' | 'all' | 'custom';
/** Compare surface available to a session. */
export type CompareSurfaceMode = 'native' | 'panel';

/** Pair projection configuration for a session. */
export interface ComparePairProjection {
  readonly mode: ComparePairProjectionMode;
  readonly pairKeys?: readonly string[];
}

/** Repository identity and root path metadata. */
export interface RepoContext {
  readonly kind: RepositoryKind;
  readonly repoRoot: string;
  readonly repoId: string;
}

/** Revision metadata used to build compare sessions. */
export interface RevisionRef {
  readonly id: string;
  readonly shortLabel: string;
  readonly author?: string;
  readonly email?: string;
  readonly message?: string;
  readonly timestamp?: number;
  readonly relativePath?: string;
}

/** Resolved source file in repository space. */
export interface SnapshotResource {
  readonly repo: RepoContext;
  readonly relativePath: string;
  readonly revision: string;
  readonly uri: vscode.Uri;
  readonly title: string;
}

/** Pair of snapshot resources for two-way compare operations. */
export interface DiffPair {
  readonly left: SnapshotResource;
  readonly right: SnapshotResource;
  readonly title: string;
}

/** Intraline change segment for highlighted text diffs. */
export interface IntralineSegment {
  readonly startCharacter: number;
  readonly endCharacter: number;
  readonly kind: 'added' | 'removed';
}

/** Change details attached to an aligned line. */
export interface AlignedLineChange {
  readonly kind: CompareChangeKind;
  readonly counterpartText?: string;
  readonly counterpartLineNumber?: number;
  readonly intralineSegments: readonly IntralineSegment[];
}

/** Single line in an aligned compare surface. */
export interface AlignedLine {
  readonly rowNumber: number;
  readonly present: boolean;
  readonly text: string;
  readonly originalLineNumber?: number;
  readonly prevChange?: AlignedLineChange;
  readonly nextChange?: AlignedLineChange;
  readonly blameAgeBucket?: number;
  readonly blameInfo?: BlameLineInfo;
}

/** Bidirectional lookup between document lines and original line numbers. */
export interface AlignedLineMap {
  readonly rowToOriginalLine: ReadonlyMap<number, number>;
  readonly originalLineToRow: ReadonlyMap<number, number>;
}

/** Snapshot document payload used by aligned session editors. */
export interface CompareSourceDocument {
  readonly revisionIndex: number;
  readonly revisionId: string;
  readonly revisionLabel: string;
  readonly relativePath: string;
  readonly snapshotUri: vscode.Uri;
  readonly rawUri: vscode.Uri;
  readonly text: string;
  readonly blameLines?: readonly BlameLineInfo[];
}

/** Aligned row cell for a specific revision column. */
export interface GlobalRowCell extends AlignedLine {
  readonly revisionIndex: number;
}

/** One canonical row across every visible revision. */
export interface GlobalRow {
  readonly rowNumber: number;
  readonly cells: readonly GlobalRowCell[];
}

/** Projection overlay for a visible revision pair. */
export interface ComparePairOverlay {
  readonly leftRevisionIndex: number;
  readonly rightRevisionIndex: number;
  readonly key: string;
  readonly label: string;
  readonly changedRowNumbers: readonly number[];
}

/** Back-compat alias for pair overlays. */
export type AdjacentPairOverlay = ComparePairOverlay;

/** Raw historical snapshot content for one revision. */
export interface RawSnapshot {
  readonly snapshotUri: vscode.Uri;
  readonly rawUri: vscode.Uri;
  readonly revisionIndex: number;
  readonly revisionId: string;
  readonly revisionLabel: string;
  readonly relativePath: string;
  readonly lineMap: AlignedLineMap;
}

/** Cached alignment result for an N-way session. */
export interface CompareAlignmentState {
  readonly rowCount: number;
  readonly rawSnapshots: readonly RawSnapshot[];
  readonly globalRows: readonly GlobalRow[];
  readonly adjacentPairs: readonly AdjacentPairOverlay[];
}

/** Visible revision window for native compare paging. */
export interface VisibleRevisionWindow {
  readonly startRevisionIndex: number;
  readonly endRevisionIndex: number;
  readonly rawSnapshots: readonly RawSnapshot[];
}

/** Immutable compare session model. */
export interface NWayCompareSession {
  readonly id: string;
  readonly uri: vscode.Uri;
  readonly repo: RepoContext;
  readonly originalUri: vscode.Uri;
  readonly relativePath: string;
  readonly revisions: readonly RevisionRef[];
  readonly createdAt: number;
  readonly rowCount: number;
  readonly rawSnapshots: readonly RawSnapshot[];
  readonly globalRows: readonly GlobalRow[];
  readonly adjacentPairs: readonly AdjacentPairOverlay[];
  readonly pairProjection: ComparePairProjection;
  readonly surfaceMode: CompareSurfaceMode;
}

/** Mutable selection state for one session. */
export interface SessionViewState {
  readonly activeRevisionIndex: number;
  readonly activePairKey?: string;
  readonly pageStart: number;
}

/** Mapping between displayed document lines and global row numbers. */
export interface SessionProjectedLineMap {
  readonly documentLineToGlobalRow: ReadonlyMap<number, number>;
  readonly globalRowToDocumentLine: ReadonlyMap<number, number>;
}

/** Row projection state shared between native and panel surfaces. */
export interface SessionRowProjectionState {
  readonly collapseUnchanged: boolean;
  readonly expandedGapKeys: readonly string[];
}

/** Binding for a virtual or native editor that belongs to a session. */
export interface NativeEditorBinding {
  readonly sessionId: string;
  readonly revisionIndex: number;
  readonly revisionId: string;
  readonly relativePath: string;
  readonly rawUri: vscode.Uri;
  readonly documentUri: vscode.Uri;
  readonly lineNumberSpace: SessionLineNumberSpace;
  readonly windowStart?: number;
  readonly projectedGlobalRows?: readonly number[];
  readonly projectedLineMap?: SessionProjectedLineMap;
}

/** Historical snapshot alias used by older call sites. */
export type CompareSnapshot = RawSnapshot;
/** Document numbering space for session-backed editors. */
export type SessionLineNumberSpace = 'original' | 'globalRow';
/** Binding alias used by session file consumers. */
export type SessionFileBinding = NativeEditorBinding;

/** Blame metadata attached to a line. */
export interface BlameLineInfo {
  readonly lineNumber: number;
  readonly revision: string;
  readonly author: string;
  readonly email?: string;
  readonly summary?: string;
  readonly timestamp?: number;
}

/** Parsed `multidiff:` snapshot URI. */
export interface ParsedSnapshotUri {
  readonly kind: RepositoryKind;
  readonly repoId: string;
  readonly relativePath: string;
  readonly displayRelativePath: string;
  readonly revision: string;
}

/** Parsed session URI. */
export interface ParsedSessionUri {
  readonly sessionId: string;
  readonly relativePath: string;
}

/** Parsed aligned session document URI. */
export interface ParsedSessionDocumentUri {
  readonly sessionId: string;
  readonly windowStart: number;
  readonly revisionIndex: number;
  readonly relativePath: string;
  readonly revisionLabel: string;
}

/** Repository resource resolved from a user-selected URI. */
export interface ResolvedResource {
  readonly repo: RepoContext;
  readonly relativePath: string;
  readonly originalUri: vscode.Uri;
  readonly revision?: string;
}

/** Stored cache metadata for one entry. */
export interface CacheEntryMetadata {
  readonly key: string;
  readonly namespace: string;
  readonly repoId: string;
  readonly relativePath: string;
  readonly size: number;
  readonly updatedAt: number;
}

/** Cache summary row used by the cache tree. */
export interface CacheOverviewItem {
  readonly repoId: string;
  readonly size: number;
  readonly entryCount: number;
  readonly namespaces: ReadonlyMap<string, number>;
}
