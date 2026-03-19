import {
  ComparePairOverlay,
  NWayCompareSession,
  SessionProjectedLineMap,
  VisibleRevisionWindow
} from '../adapters/common/types';
import { getVisiblePairOverlays } from './comparePairing';
import { CompareRowProjectionOptions, CompareRowProjectionResult, projectChangedRowNumbers } from './compareRowProjection';

export interface SessionRowProjectionResult {
  readonly visiblePairs: readonly ComparePairOverlay[];
  readonly projection: CompareRowProjectionResult;
  readonly visibleDataRowNumbers: readonly number[];
  readonly projectedLineMap: SessionProjectedLineMap;
}

export function buildSessionRowProjection(
  session: Pick<NWayCompareSession, 'rowCount' | 'rawSnapshots' | 'pairProjection' | 'adjacentPairs' | 'globalRows'>,
  visibleWindow: VisibleRevisionWindow,
  options: CompareRowProjectionOptions
): SessionRowProjectionResult {
  const visiblePairs = getVisiblePairOverlays(session, visibleWindow);
  const changedRowNumbers = [...new Set(visiblePairs.flatMap((pair) => pair.changedRowNumbers))];
  const projection = projectChangedRowNumbers(session.rowCount, changedRowNumbers, options);
  const visibleDataRowNumbers = projection.rows
    .flatMap((row) => row.kind === 'data' ? [row.rowNumber] : []);
  const projectedLineMap = createProjectedLineMap(visibleDataRowNumbers);

  return {
    visiblePairs,
    projection,
    visibleDataRowNumbers,
    projectedLineMap
  };
}

export function createProjectedLineMap(visibleGlobalRowNumbers: readonly number[]): SessionProjectedLineMap {
  const documentLineToGlobalRow = new Map<number, number>();
  const globalRowToDocumentLine = new Map<number, number>();

  visibleGlobalRowNumbers.forEach((globalRowNumber, index) => {
    const documentLineNumber = index + 1;
    documentLineToGlobalRow.set(documentLineNumber, globalRowNumber);
    globalRowToDocumentLine.set(globalRowNumber, documentLineNumber);
  });

  return {
    documentLineToGlobalRow,
    globalRowToDocumentLine
  };
}
