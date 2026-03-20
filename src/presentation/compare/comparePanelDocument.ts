import { ComparePairOverlay, NWayCompareSession, SessionViewState } from '../../adapters/common/types';
import { getPairProjectionLabel } from '../../application/comparePairing';
import { CompareRowProjectionOptions } from '../../application/compareRowProjection';
import { buildCompareRowDisplayState, CompareRowCellDisplayState } from '../../application/compareRowDisplayState';
import { deriveSessionCapabilityState } from '../../application/sessionCapabilities';
import { buildSessionViewport } from '../../application/sessionViewport';

export interface ComparePanelCellModel {
  readonly revisionIndex: number;
  readonly text: string;
  readonly present: boolean;
  readonly html: string;
  readonly classNames: readonly string[];
}

export interface ComparePanelDataRowModel {
  readonly kind: 'data';
  readonly rowNumber: number;
  readonly classNames: readonly string[];
  readonly cells: readonly ComparePanelCellModel[];
}

export interface ComparePanelGapRowModel {
  readonly kind: 'gap';
  readonly gapKey: string;
  readonly startRowNumber: number;
  readonly endRowNumber: number;
  readonly hiddenRowCount: number;
  readonly label: string;
  readonly classNames: readonly string[];
}

export type ComparePanelRowModel = ComparePanelDataRowModel | ComparePanelGapRowModel;

export interface ComparePanelColumnModel {
  readonly revisionIndex: number;
  readonly revisionLabel: string;
  readonly revisionId: string;
  readonly isActive: boolean;
}

export interface ComparePanelPairModel {
  readonly key: string;
  readonly label: string;
  readonly isActive: boolean;
}

export interface ComparePanelViewModel {
  readonly relativePath: string;
  readonly pairProjectionLabel: string;
  readonly collapseUnchanged: boolean;
  readonly totalRowCount: number;
  readonly hiddenRowCount: number;
  readonly collapsedGapCount: number;
  readonly expandedGapCount: number;
  readonly canChangePairProjection: boolean;
  readonly hasActiveSnapshot: boolean;
  readonly hasActivePair: boolean;
  readonly columns: readonly ComparePanelColumnModel[];
  readonly pairs: readonly ComparePanelPairModel[];
  readonly rows: readonly ComparePanelRowModel[];
  readonly activeRevisionLabel?: string;
  readonly activePairLabel?: string;
}

export function buildComparePanelViewModel(
  session: NWayCompareSession,
  viewState: SessionViewState,
  options: CompareRowProjectionOptions = { collapseUnchanged: false }
): ComparePanelViewModel {
  const viewport = buildSessionViewport(session, viewState, options);
  const capabilities = deriveSessionCapabilityState(session, viewState, {
    collapseUnchanged: options.collapseUnchanged,
    expandedGapKeys: [...(options.expandedGapKeys ?? [])]
  }, viewport);
  const activePair = viewport.activePair;
  const visiblePairs = viewport.visiblePairs;
  const rowProjection = viewport.rowProjection;
  const collapsedGapCount = rowProjection.rows.filter((row) => row.kind === 'gap').length;

  return {
    relativePath: session.relativePath,
    pairProjectionLabel: getPairProjectionLabel(session.pairProjection),
    collapseUnchanged: options.collapseUnchanged,
    totalRowCount: rowProjection.totalRowCount,
    hiddenRowCount: rowProjection.hiddenRowCount,
    collapsedGapCount,
    expandedGapCount: new Set(options.expandedGapKeys ?? []).size,
    canChangePairProjection: capabilities.canChangePairProjection,
    hasActiveSnapshot: capabilities.hasActiveSnapshot,
    hasActivePair: capabilities.hasActivePair,
    columns: session.rawSnapshots.map((snapshot) => ({
      revisionIndex: snapshot.revisionIndex,
      revisionLabel: snapshot.revisionLabel,
      revisionId: snapshot.revisionId,
      isActive: snapshot.revisionIndex === viewState.activeRevisionIndex
    })),
    pairs: visiblePairs.map((pair) => ({
      key: pair.key,
      label: pair.label,
      isActive: pair.key === activePair?.key
    })),
    rows: rowProjection.rows.map((row) => (
      row.kind === 'data'
        ? buildDataRowModel(row.rowNumber, session, visiblePairs, activePair)
        : buildGapRowModel(row.gapKey, row.startRowNumber, row.endRowNumber, row.hiddenRowCount)
    )),
    activeRevisionLabel: capabilities.activeRevisionLabel,
    activePairLabel: capabilities.activePairLabel
  };
}

function buildDataRowModel(
  rowNumber: number,
  session: NWayCompareSession,
  visiblePairs: readonly ComparePairOverlay[],
  activePair: ComparePairOverlay | undefined
): ComparePanelDataRowModel {
  const row = session.globalRows[rowNumber - 1];
  const rowDisplayState = buildCompareRowDisplayState(session, rowNumber, visiblePairs, activePair);

  return {
    kind: 'data',
    rowNumber,
    classNames: rowDisplayState.isActivePairRow ? ['row', 'row--active-pair'] : ['row'],
    cells: row.cells.map((cell) => buildCellModel(cell.revisionIndex, cell.text, cell.present, rowDisplayState.cells[cell.revisionIndex]))
  };
}

function buildGapRowModel(
  gapKey: string,
  startRowNumber: number,
  endRowNumber: number,
  hiddenRowCount: number
): ComparePanelGapRowModel {
  return {
    kind: 'gap',
    gapKey,
    startRowNumber,
    endRowNumber,
    hiddenRowCount,
    label: `Show ${hiddenRowCount} unchanged rows (${startRowNumber}-${endRowNumber})`,
    classNames: ['row', 'row--gap']
  };
}

function buildCellModel(
  revisionIndex: number,
  text: string,
  present: boolean,
  cellState: CompareRowCellDisplayState | undefined
): ComparePanelCellModel {
  const classNames = ['cell'];
  let html = present ? escapeHtml(text) : '&nbsp;';

  if (!present) {
    classNames.push('cell--empty');
  }

  if (cellState?.hasNextPairEdge) {
    classNames.push('cell--edge-next');
  }
  if (cellState?.hasPreviousPairEdge) {
    classNames.push('cell--edge-prev');
  }

  switch (cellState?.activeChangeKind) {
    case 'added':
      classNames.push('cell--active-added');
      break;
    case 'removed':
      classNames.push('cell--active-removed');
      break;
    case 'modified':
      classNames.push('cell--active-modified');
      html = renderSegments(
        text,
        cellState.activeIntralineSegments,
        cellState.activeSegmentKind === 'removed' ? 'seg--removed' : 'seg--added'
      );
      break;
    default:
      break;
  }

  return {
    revisionIndex,
    text,
    present,
    html,
    classNames
  };
}

function renderSegments(
  text: string,
  segments: readonly { readonly startCharacter: number; readonly endCharacter: number }[],
  className: string
): string {
  if (segments.length === 0) {
    return escapeHtml(text);
  }

  let cursor = 0;
  let html = '';
  for (const segment of segments) {
    if (segment.startCharacter > cursor) {
      html += escapeHtml(text.slice(cursor, segment.startCharacter));
    }
    html += `<span class="${className}">${escapeHtml(text.slice(segment.startCharacter, segment.endCharacter))}</span>`;
    cursor = segment.endCharacter;
  }
  if (cursor < text.length) {
    html += escapeHtml(text.slice(cursor));
  }
  return html;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
