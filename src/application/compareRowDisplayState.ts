import { ComparePairOverlay, IntralineSegment, NWayCompareSession } from '../adapters/common/types';
import { buildIntralineDiff } from './sessionAlignmentService';

export type ActiveCompareCellChangeKind = 'none' | 'added' | 'removed' | 'modified';

export interface CompareRowCellDisplayState {
  readonly revisionIndex: number;
  readonly hasPreviousPairEdge: boolean;
  readonly hasNextPairEdge: boolean;
  readonly activeChangeKind: ActiveCompareCellChangeKind;
  readonly activeSegmentKind: 'none' | 'added' | 'removed';
  readonly activeIntralineSegments: readonly IntralineSegment[];
}

export interface CompareRowDisplayState {
  readonly rowNumber: number;
  readonly isActivePairRow: boolean;
  readonly cells: readonly CompareRowCellDisplayState[];
}

export function buildCompareRowDisplayState(
  session: Pick<NWayCompareSession, 'globalRows'>,
  rowNumber: number,
  visiblePairs: readonly ComparePairOverlay[],
  activePair: ComparePairOverlay | undefined
): CompareRowDisplayState {
  const row = session.globalRows[rowNumber - 1];
  if (!row) {
    return {
      rowNumber,
      isActivePairRow: false,
      cells: []
    };
  }

  const previousPairEdges = new Set<number>();
  const nextPairEdges = new Set<number>();
  for (const pair of visiblePairs) {
    if (!pair.changedRowNumbers.includes(rowNumber)) {
      continue;
    }

    nextPairEdges.add(pair.leftRevisionIndex);
    previousPairEdges.add(pair.rightRevisionIndex);
  }

  const cells: CompareRowCellDisplayState[] = row.cells.map((cell) => ({
    revisionIndex: cell.revisionIndex,
    hasPreviousPairEdge: previousPairEdges.has(cell.revisionIndex),
    hasNextPairEdge: nextPairEdges.has(cell.revisionIndex),
    activeChangeKind: 'none' as const,
    activeSegmentKind: 'none' as const,
    activeIntralineSegments: [] as readonly IntralineSegment[]
  }));

  if (!activePair?.changedRowNumbers.includes(rowNumber)) {
    return {
      rowNumber,
      isActivePairRow: false,
      cells
    };
  }

  const leftCell = row.cells[activePair.leftRevisionIndex];
  const rightCell = row.cells[activePair.rightRevisionIndex];
  if (!leftCell || !rightCell) {
    return {
      rowNumber,
      isActivePairRow: false,
      cells
    };
  }

  if (leftCell.present && !rightCell.present) {
    cells[leftCell.revisionIndex] = {
      ...cells[leftCell.revisionIndex],
      activeChangeKind: 'removed',
      activeSegmentKind: 'removed'
    };
  } else if (!leftCell.present && rightCell.present) {
    cells[rightCell.revisionIndex] = {
      ...cells[rightCell.revisionIndex],
      activeChangeKind: 'added',
      activeSegmentKind: 'added'
    };
  } else if (leftCell.present && rightCell.present && leftCell.text !== rightCell.text) {
    const intraline = buildIntralineDiff(leftCell.text, rightCell.text);
    cells[leftCell.revisionIndex] = {
      ...cells[leftCell.revisionIndex],
      activeChangeKind: 'modified',
      activeSegmentKind: 'removed',
      activeIntralineSegments: intraline.left
    };
    cells[rightCell.revisionIndex] = {
      ...cells[rightCell.revisionIndex],
      activeChangeKind: 'modified',
      activeSegmentKind: 'added',
      activeIntralineSegments: intraline.right
    };
  }

  return {
    rowNumber,
    isActivePairRow: true,
    cells
  };
}
