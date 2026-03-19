export interface CompareRowProjectionOptions {
  readonly collapseUnchanged: boolean;
  readonly contextLineCount?: number;
  readonly minimumCollapsedRows?: number;
  readonly expandedGapKeys?: readonly string[];
}

export interface CompareProjectedDataRow {
  readonly kind: 'data';
  readonly rowNumber: number;
}

export interface CompareProjectedGapRow {
  readonly kind: 'gap';
  readonly gapKey: string;
  readonly startRowNumber: number;
  readonly endRowNumber: number;
  readonly hiddenRowCount: number;
}

export type CompareProjectedRow = CompareProjectedDataRow | CompareProjectedGapRow;

export interface CompareRowProjectionResult {
  readonly totalRowCount: number;
  readonly projectedRowCount: number;
  readonly hiddenRowCount: number;
  readonly rows: readonly CompareProjectedRow[];
}

const DEFAULT_CONTEXT_LINE_COUNT = 3;
const DEFAULT_MINIMUM_COLLAPSED_ROWS = 4;

export function projectChangedRowNumbers(
  totalRowCount: number,
  changedRowNumbers: readonly number[],
  options: CompareRowProjectionOptions
): CompareRowProjectionResult {
  if (totalRowCount <= 0) {
    return {
      totalRowCount: 0,
      projectedRowCount: 0,
      hiddenRowCount: 0,
      rows: []
    };
  }

  if (!options.collapseUnchanged) {
    return {
      totalRowCount,
      projectedRowCount: totalRowCount,
      hiddenRowCount: 0,
      rows: Array.from({ length: totalRowCount }, (_, index) => ({
        kind: 'data',
        rowNumber: index + 1
      }))
    };
  }

  const contextLineCount = Math.max(0, options.contextLineCount ?? DEFAULT_CONTEXT_LINE_COUNT);
  const minimumCollapsedRows = Math.max(1, options.minimumCollapsedRows ?? DEFAULT_MINIMUM_COLLAPSED_ROWS);
  const expandedGapKeys = new Set(options.expandedGapKeys ?? []);
  const preservedRows = new Set<number>();

  for (const changedRowNumber of changedRowNumbers) {
    const safeRowNumber = Math.max(1, Math.min(totalRowCount, changedRowNumber));
    for (let rowNumber = Math.max(1, safeRowNumber - contextLineCount); rowNumber <= Math.min(totalRowCount, safeRowNumber + contextLineCount); rowNumber += 1) {
      preservedRows.add(rowNumber);
    }
  }

  if (preservedRows.size === 0) {
    const hiddenRowCount = totalRowCount;
    const gapKey = buildGapKey(1, totalRowCount);
    return {
      totalRowCount,
      projectedRowCount: expandedGapKeys.has(gapKey) ? totalRowCount : 1,
      hiddenRowCount: expandedGapKeys.has(gapKey) ? 0 : hiddenRowCount,
      rows: expandedGapKeys.has(gapKey)
        ? Array.from({ length: totalRowCount }, (_, index) => ({
          kind: 'data',
          rowNumber: index + 1
        }))
        : [{
          kind: 'gap',
          gapKey,
          startRowNumber: 1,
          endRowNumber: totalRowCount,
          hiddenRowCount
        }]
    };
  }

  const rows: CompareProjectedRow[] = [];
  let hiddenRowCount = 0;

  for (let rowNumber = 1; rowNumber <= totalRowCount;) {
    if (preservedRows.has(rowNumber)) {
      rows.push({
        kind: 'data',
        rowNumber
      });
      rowNumber += 1;
      continue;
    }

    const startRowNumber = rowNumber;
    while (rowNumber <= totalRowCount && !preservedRows.has(rowNumber)) {
      rowNumber += 1;
    }

    const endRowNumber = rowNumber - 1;
    const unchangedCount = endRowNumber - startRowNumber + 1;
    const gapKey = buildGapKey(startRowNumber, endRowNumber);
    if (unchangedCount < minimumCollapsedRows || expandedGapKeys.has(gapKey)) {
      for (let visibleRowNumber = startRowNumber; visibleRowNumber <= endRowNumber; visibleRowNumber += 1) {
        rows.push({
          kind: 'data',
          rowNumber: visibleRowNumber
        });
      }
      continue;
    }

    hiddenRowCount += unchangedCount;
    rows.push({
      kind: 'gap',
      gapKey,
      startRowNumber,
      endRowNumber,
      hiddenRowCount: unchangedCount
    });
  }

  return {
    totalRowCount,
    projectedRowCount: rows.length,
    hiddenRowCount,
    rows
  };
}

export function buildGapKey(startRowNumber: number, endRowNumber: number): string {
  return `${startRowNumber}:${endRowNumber}`;
}
