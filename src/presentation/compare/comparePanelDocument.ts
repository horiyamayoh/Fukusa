import { ComparePairOverlay, NWayCompareSession, SessionViewState } from '../../adapters/common/types';
import { getPairProjectionLabel } from '../../application/comparePairing';
import { CompareRowProjectionOptions } from '../../application/compareRowProjection';
import { buildIntralineDiff } from '../../application/sessionAlignmentService';
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
    activeRevisionLabel: session.rawSnapshots[viewState.activeRevisionIndex]?.revisionLabel,
    activePairLabel: activePair?.label
  };
}

function buildDataRowModel(
  rowNumber: number,
  session: NWayCompareSession,
  visiblePairs: readonly ComparePairOverlay[],
  activePair: ComparePairOverlay | undefined
): ComparePanelDataRowModel {
  const row = session.globalRows[rowNumber - 1];
  const activePairIsChanged = activePair?.changedRowNumbers.includes(rowNumber) ?? false;

  return {
    kind: 'data',
    rowNumber,
    classNames: activePairIsChanged ? ['row', 'row--active-pair'] : ['row'],
    cells: row.cells.map((cell) => buildCellModel(cell.revisionIndex, rowNumber, session, visiblePairs, activePair))
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
  rowNumber: number,
  session: NWayCompareSession,
  visiblePairs: readonly ComparePairOverlay[],
  activePair: ComparePairOverlay | undefined
): ComparePanelCellModel {
  const cell = session.globalRows[rowNumber - 1].cells[revisionIndex];
  const classNames = ['cell'];
  let html = cell.present ? escapeHtml(cell.text) : '&nbsp;';

  if (!cell.present) {
    classNames.push('cell--empty');
  }

  if (visiblePairs.some((pair) => pair.leftRevisionIndex === revisionIndex && pair.changedRowNumbers.includes(rowNumber))) {
    classNames.push('cell--edge-next');
  }
  if (visiblePairs.some((pair) => pair.rightRevisionIndex === revisionIndex && pair.changedRowNumbers.includes(rowNumber))) {
    classNames.push('cell--edge-prev');
  }

  if (activePair?.changedRowNumbers.includes(rowNumber)) {
    const leftCell = session.globalRows[rowNumber - 1].cells[activePair.leftRevisionIndex];
    const rightCell = session.globalRows[rowNumber - 1].cells[activePair.rightRevisionIndex];

    if (revisionIndex === activePair.leftRevisionIndex) {
      if (leftCell.present && !rightCell.present) {
        classNames.push('cell--active-removed');
      } else if (leftCell.present && rightCell.present && leftCell.text !== rightCell.text) {
        classNames.push('cell--active-modified');
        html = renderSegments(leftCell.text, buildIntralineDiff(leftCell.text, rightCell.text).left, 'seg--removed');
      }
    } else if (revisionIndex === activePair.rightRevisionIndex) {
      if (!leftCell.present && rightCell.present) {
        classNames.push('cell--active-added');
      } else if (leftCell.present && rightCell.present && leftCell.text !== rightCell.text) {
        classNames.push('cell--active-modified');
        html = renderSegments(rightCell.text, buildIntralineDiff(leftCell.text, rightCell.text).right, 'seg--added');
      }
    }
  }

  return {
    revisionIndex,
    text: cell.text,
    present: cell.present,
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
