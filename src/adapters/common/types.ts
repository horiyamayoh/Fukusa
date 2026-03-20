import * as vscode from 'vscode';

export type RepositoryKind = 'git' | 'svn';
export type CacheValueKind = 'binary' | 'json';
export type CompareChangeKind = 'added' | 'removed' | 'modified';
export type ComparePairProjectionMode = 'adjacent' | 'base' | 'all' | 'custom';
export type CompareSurfaceMode = 'native' | 'panel';

export interface ComparePairProjection {
  readonly mode: ComparePairProjectionMode;
  readonly pairKeys?: readonly string[];
}

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
  readonly relativePath?: string;
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

export interface IntralineSegment {
  readonly startCharacter: number;
  readonly endCharacter: number;
  readonly kind: 'added' | 'removed';
}

export interface AlignedLineChange {
  readonly kind: CompareChangeKind;
  readonly counterpartText?: string;
  readonly counterpartLineNumber?: number;
  readonly intralineSegments: readonly IntralineSegment[];
}

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

export interface AlignedLineMap {
  readonly rowToOriginalLine: ReadonlyMap<number, number>;
  readonly originalLineToRow: ReadonlyMap<number, number>;
}

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

export interface GlobalRowCell extends AlignedLine {
  readonly revisionIndex: number;
}

export interface GlobalRow {
  readonly rowNumber: number;
  readonly cells: readonly GlobalRowCell[];
}

export interface ComparePairOverlay {
  readonly leftRevisionIndex: number;
  readonly rightRevisionIndex: number;
  readonly key: string;
  readonly label: string;
  readonly changedRowNumbers: readonly number[];
}

export type AdjacentPairOverlay = ComparePairOverlay;

export interface RawSnapshot {
  readonly snapshotUri: vscode.Uri;
  readonly rawUri: vscode.Uri;
  readonly revisionIndex: number;
  readonly revisionId: string;
  readonly revisionLabel: string;
  readonly relativePath: string;
  readonly lineMap: AlignedLineMap;
}

export interface CompareAlignmentState {
  readonly rowCount: number;
  readonly rawSnapshots: readonly RawSnapshot[];
  readonly globalRows: readonly GlobalRow[];
  readonly adjacentPairs: readonly AdjacentPairOverlay[];
}

export interface VisibleRevisionWindow {
  readonly startRevisionIndex: number;
  readonly endRevisionIndex: number;
  readonly rawSnapshots: readonly RawSnapshot[];
}

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

export interface SessionViewState {
  readonly activeRevisionIndex: number;
  readonly activePairKey?: string;
  readonly pageStart: number;
}

export interface SessionProjectedLineMap {
  readonly documentLineToGlobalRow: ReadonlyMap<number, number>;
  readonly globalRowToDocumentLine: ReadonlyMap<number, number>;
}

export interface SessionRowProjectionState {
  readonly collapseUnchanged: boolean;
  readonly expandedGapKeys: readonly string[];
}

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

export type CompareSnapshot = RawSnapshot;
export type SessionLineNumberSpace = 'original' | 'globalRow';
export type SessionFileBinding = NativeEditorBinding;

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

export interface ParsedSessionUri {
  readonly sessionId: string;
  readonly relativePath: string;
}

export interface ParsedSessionDocumentUri {
  readonly sessionId: string;
  readonly windowStart: number;
  readonly revisionIndex: number;
  readonly relativePath: string;
  readonly revisionLabel: string;
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
