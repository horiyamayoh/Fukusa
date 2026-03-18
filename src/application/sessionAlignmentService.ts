import { diffLines, diffWordsWithSpace } from 'diff';

import {
  AdjacentPairOverlay,
  AlignedLineChange,
  AlignedLineMap,
  BlameLineInfo,
  CompareAlignmentState,
  CompareSourceDocument,
  GlobalRow,
  GlobalRowCell,
  IntralineSegment,
  RawSnapshot
} from '../adapters/common/types';

interface CanonicalEntry {
  readonly lineNumber: number;
  readonly text: string;
}

interface CanonicalRow {
  readonly entries: Array<CanonicalEntry | undefined>;
}

interface PairAlignmentRow {
  readonly left?: CanonicalEntry;
  readonly right?: CanonicalEntry;
}

export class SessionAlignmentService {
  public buildState(sources: readonly CompareSourceDocument[]): CompareAlignmentState {
    if (sources.length === 0) {
      return {
        rowCount: 0,
        rawSnapshots: [],
        globalRows: [],
        adjacentPairs: []
      };
    }

    const normalizedLinesBySource = sources.map((source) => splitDocumentLines(source.text));
    const rows = buildCanonicalRows(normalizedLinesBySource);
    const blameLookups = sources.map((source) => buildBlameLookup(source.blameLines));
    const globalRows = buildGlobalRows(rows, blameLookups);
    const rawSnapshots = buildSnapshots(sources, globalRows);
    const adjacentPairs = buildAdjacentPairs(sources, globalRows);

    return {
      rowCount: globalRows.length,
      rawSnapshots,
      globalRows,
      adjacentPairs
    };
  }
}

export function buildIntralineDiff(
  leftText: string,
  rightText: string
): { readonly left: readonly IntralineSegment[]; readonly right: readonly IntralineSegment[] } {
  const changes = diffWordsWithSpace(leftText, rightText);
  const left: IntralineSegment[] = [];
  const right: IntralineSegment[] = [];
  let leftOffset = 0;
  let rightOffset = 0;

  for (const change of changes) {
    const length = change.value.length;
    if (length === 0) {
      continue;
    }

    if (change.added) {
      right.push({
        startCharacter: rightOffset,
        endCharacter: rightOffset + length,
        kind: 'added'
      });
      rightOffset += length;
      continue;
    }

    if (change.removed) {
      left.push({
        startCharacter: leftOffset,
        endCharacter: leftOffset + length,
        kind: 'removed'
      });
      leftOffset += length;
      continue;
    }

    leftOffset += length;
    rightOffset += length;
  }

  return {
    left: coalesceSegments(left),
    right: coalesceSegments(right)
  };
}

function buildGlobalRows(rows: readonly CanonicalRow[], blameLookups: readonly Map<number, number>[]): GlobalRow[] {
  return rows.map((row, index) => ({
    rowNumber: index + 1,
    cells: row.entries.map((entry, revisionIndex) => ({
      revisionIndex,
      rowNumber: index + 1,
      present: entry !== undefined,
      text: entry?.text ?? '',
      originalLineNumber: entry?.lineNumber,
      prevChange: revisionIndex > 0 ? buildChangeFromPrevious(row.entries[revisionIndex - 1], entry) : undefined,
      nextChange: revisionIndex < row.entries.length - 1 ? buildChangeToNext(entry, row.entries[revisionIndex + 1]) : undefined,
      blameAgeBucket: entry ? blameLookups[revisionIndex].get(entry.lineNumber) : undefined
    }))
  }));
}

function buildSnapshots(sources: readonly CompareSourceDocument[], rows: readonly GlobalRow[]): RawSnapshot[] {
  return sources.map((source, sourceIndex) => ({
    snapshotUri: source.snapshotUri,
    rawUri: source.rawUri,
    revisionIndex: source.revisionIndex,
    revisionId: source.revisionId,
    revisionLabel: source.revisionLabel,
    relativePath: source.relativePath,
    lineMap: buildLineMap(rows, sourceIndex)
  }));
}

function buildAdjacentPairs(sources: readonly CompareSourceDocument[], rows: readonly GlobalRow[]): AdjacentPairOverlay[] {
  return sources.slice(0, -1).map((source, index) => ({
    key: `${index}:${index + 1}`,
    leftRevisionIndex: index,
    rightRevisionIndex: index + 1,
    label: `${source.revisionLabel}-${sources[index + 1].revisionLabel}`,
    changedRowNumbers: rows
      .filter((row) => isPairRowChanged(row.cells[index], row.cells[index + 1]))
      .map((row) => row.rowNumber)
  }));
}

function isPairRowChanged(left: GlobalRowCell, right: GlobalRowCell): boolean {
  if (left.present !== right.present) {
    return true;
  }

  if (!left.present && !right.present) {
    return false;
  }

  return left.text !== right.text;
}

function buildLineMap(rows: readonly GlobalRow[], sourceIndex: number): AlignedLineMap {
  const rowToOriginalLine = new Map<number, number>();
  const originalLineToRow = new Map<number, number>();

  for (const row of rows) {
    const cell = row.cells[sourceIndex];
    if (!cell.present || cell.originalLineNumber === undefined) {
      continue;
    }

    rowToOriginalLine.set(row.rowNumber, cell.originalLineNumber);
    originalLineToRow.set(cell.originalLineNumber, row.rowNumber);
  }

  return {
    rowToOriginalLine,
    originalLineToRow
  };
}

function buildCanonicalRows(linesBySource: readonly string[][]): CanonicalRow[] {
  const documentCount = linesBySource.length;
  let rows = linesBySource[0].map<CanonicalRow>((text, index) => ({
    entries: createEntries(documentCount, 0, {
      lineNumber: index + 1,
      text
    })
  }));

  for (let sourceIndex = 1; sourceIndex < documentCount; sourceIndex += 1) {
    const pairRows = buildPairAlignmentRows(linesBySource[sourceIndex - 1], linesBySource[sourceIndex]);
    rows = mergePairRows(rows, pairRows, linesBySource[sourceIndex - 1].length, sourceIndex);
  }

  return rows;
}

function buildPairAlignmentRows(leftLines: readonly string[], rightLines: readonly string[]): PairAlignmentRow[] {
  const changes = diffLines(leftLines.join('\n'), rightLines.join('\n'), { stripTrailingCr: true });
  const rows: PairAlignmentRow[] = [];
  let leftLineNumber = 1;
  let rightLineNumber = 1;

  for (let changeIndex = 0; changeIndex < changes.length; changeIndex += 1) {
    const change = changes[changeIndex];
    const nextChange = changes[changeIndex + 1];

    if ((change.removed && nextChange?.added) || (change.added && nextChange?.removed)) {
      const removedLines = extractDiffLines(change.removed ? change.value : nextChange.value);
      const addedLines = extractDiffLines(change.added ? change.value : nextChange.value);
      const pairedCount = Math.min(removedLines.length, addedLines.length);

      for (let offset = 0; offset < pairedCount; offset += 1) {
        rows.push({
          left: {
            lineNumber: leftLineNumber,
            text: removedLines[offset]
          },
          right: {
            lineNumber: rightLineNumber,
            text: addedLines[offset]
          }
        });
        leftLineNumber += 1;
        rightLineNumber += 1;
      }

      for (let offset = pairedCount; offset < removedLines.length; offset += 1) {
        rows.push({
          left: {
            lineNumber: leftLineNumber,
            text: removedLines[offset]
          }
        });
        leftLineNumber += 1;
      }

      for (let offset = pairedCount; offset < addedLines.length; offset += 1) {
        rows.push({
          right: {
            lineNumber: rightLineNumber,
            text: addedLines[offset]
          }
        });
        rightLineNumber += 1;
      }

      changeIndex += 1;
      continue;
    }

    const lines = extractDiffLines(change.value);
    if (change.added) {
      for (const line of lines) {
        rows.push({
          right: {
            lineNumber: rightLineNumber,
            text: line
          }
        });
        rightLineNumber += 1;
      }
      continue;
    }

    if (change.removed) {
      for (const line of lines) {
        rows.push({
          left: {
            lineNumber: leftLineNumber,
            text: line
          }
        });
        leftLineNumber += 1;
      }
      continue;
    }

    for (const line of lines) {
      rows.push({
        left: {
          lineNumber: leftLineNumber,
          text: line
        },
        right: {
          lineNumber: rightLineNumber,
          text: line
        }
      });
      leftLineNumber += 1;
      rightLineNumber += 1;
    }
  }

  return rows;
}

function mergePairRows(
  rows: readonly CanonicalRow[],
  pairRows: readonly PairAlignmentRow[],
  previousLineCount: number,
  currentIndex: number
): CanonicalRow[] {
  const documentCount = rows[0]?.entries.length ?? currentIndex + 1;
  const previousIndex = currentIndex - 1;
  const { gaps, lineRows } = splitRowsByPreviousDocument(rows, previousIndex, previousLineCount);
  const additionsByGap = Array.from({ length: previousLineCount + 1 }, () => [] as CanonicalEntry[]);
  const matchedByPreviousLine = new Map<number, CanonicalEntry>();

  let gapIndex = 0;
  for (const pairRow of pairRows) {
    if (!pairRow.left && pairRow.right) {
      additionsByGap[gapIndex].push(pairRow.right);
      continue;
    }

    if (pairRow.left) {
      if (pairRow.right) {
        matchedByPreviousLine.set(pairRow.left.lineNumber, pairRow.right);
      }
      gapIndex = pairRow.left.lineNumber;
    }
  }

  const merged: CanonicalRow[] = [];
  for (let currentGapIndex = 0; currentGapIndex < gaps.length; currentGapIndex += 1) {
    const existingGapRows = gaps[currentGapIndex];
    const additions = additionsByGap[currentGapIndex];
    const gapRowCount = Math.max(existingGapRows.length, additions.length);

    for (let offset = 0; offset < gapRowCount; offset += 1) {
      const row = existingGapRows[offset] ?? { entries: createEntries(documentCount) };
      row.entries[currentIndex] = additions[offset];
      merged.push(row);
    }

    if (currentGapIndex < previousLineCount) {
      const previousLineNumber = currentGapIndex + 1;
      const row = lineRows[previousLineNumber];
      if (!row) {
        throw new Error(`Missing aligned row for line ${previousLineNumber} while building session alignment.`);
      }

      row.entries[currentIndex] = matchedByPreviousLine.get(previousLineNumber);
      merged.push(row);
    }
  }

  return merged;
}

function splitRowsByPreviousDocument(
  rows: readonly CanonicalRow[],
  previousIndex: number,
  previousLineCount: number
): {
  readonly gaps: CanonicalRow[][];
  readonly lineRows: Array<CanonicalRow | undefined>;
} {
  const gaps = Array.from({ length: previousLineCount + 1 }, () => [] as CanonicalRow[]);
  const lineRows = new Array<CanonicalRow | undefined>(previousLineCount + 1);
  let gapIndex = 0;

  for (const row of rows) {
    const previousEntry = row.entries[previousIndex];
    if (!previousEntry) {
      gaps[gapIndex].push({
        entries: [...row.entries]
      });
      continue;
    }

    lineRows[previousEntry.lineNumber] = {
      entries: [...row.entries]
    };
    gapIndex = previousEntry.lineNumber;
  }

  return {
    gaps,
    lineRows
  };
}

function buildChangeFromPrevious(previousEntry: CanonicalEntry | undefined, currentEntry: CanonicalEntry | undefined): AlignedLineChange | undefined {
  if (!previousEntry && !currentEntry) {
    return undefined;
  }

  if (!previousEntry && currentEntry) {
    return {
      kind: 'added',
      intralineSegments: []
    };
  }

  if (previousEntry && !currentEntry) {
    return {
      kind: 'removed',
      counterpartText: previousEntry.text,
      counterpartLineNumber: previousEntry.lineNumber,
      intralineSegments: []
    };
  }

  if (!previousEntry || !currentEntry || previousEntry.text === currentEntry.text) {
    return undefined;
  }

  const intraline = buildIntralineDiff(previousEntry.text, currentEntry.text);
  return {
    kind: 'modified',
    counterpartText: previousEntry.text,
    counterpartLineNumber: previousEntry.lineNumber,
    intralineSegments: intraline.right
  };
}

function buildChangeToNext(currentEntry: CanonicalEntry | undefined, nextEntry: CanonicalEntry | undefined): AlignedLineChange | undefined {
  if (!currentEntry && !nextEntry) {
    return undefined;
  }

  if (currentEntry && !nextEntry) {
    return {
      kind: 'removed',
      intralineSegments: []
    };
  }

  if (!currentEntry && nextEntry) {
    return {
      kind: 'added',
      counterpartText: nextEntry.text,
      counterpartLineNumber: nextEntry.lineNumber,
      intralineSegments: []
    };
  }

  if (!currentEntry || !nextEntry || currentEntry.text === nextEntry.text) {
    return undefined;
  }

  const intraline = buildIntralineDiff(currentEntry.text, nextEntry.text);
  return {
    kind: 'modified',
    counterpartText: nextEntry.text,
    counterpartLineNumber: nextEntry.lineNumber,
    intralineSegments: intraline.left
  };
}

function coalesceSegments(segments: readonly IntralineSegment[]): readonly IntralineSegment[] {
  if (segments.length < 2) {
    return segments;
  }

  const merged: IntralineSegment[] = [];
  for (const segment of segments) {
    const previous = merged.at(-1);
    if (previous && previous.kind === segment.kind && previous.endCharacter === segment.startCharacter) {
      merged[merged.length - 1] = {
        ...previous,
        endCharacter: segment.endCharacter
      };
      continue;
    }

    merged.push(segment);
  }

  return merged;
}

function buildBlameLookup(lines: readonly BlameLineInfo[] | undefined): Map<number, number> {
  const lookup = new Map<number, number>();
  if (!lines) {
    return lookup;
  }

  for (const line of lines) {
    lookup.set(line.lineNumber, bucketizeAge(line.timestamp));
  }

  return lookup;
}

function bucketizeAge(timestamp: number | undefined, now = Date.now()): number {
  if (!timestamp) {
    return 4;
  }

  const ageDays = (now - timestamp) / (1000 * 60 * 60 * 24);
  if (ageDays <= 30) {
    return 0;
  }
  if (ageDays <= 180) {
    return 1;
  }
  if (ageDays <= 365) {
    return 2;
  }
  if (ageDays <= 730) {
    return 3;
  }
  return 4;
}

function createEntries(length: number, activeIndex?: number, entry?: CanonicalEntry): Array<CanonicalEntry | undefined> {
  const entries = Array.from({ length }, () => undefined as CanonicalEntry | undefined);
  if (activeIndex !== undefined && entry) {
    entries[activeIndex] = entry;
  }
  return entries;
}

function splitDocumentLines(text: string): string[] {
  return extractDiffLines(text);
}

function extractDiffLines(value: string): string[] {
  if (value.length === 0) {
    return [];
  }

  const normalized = normalizeLineEndings(value);
  const lines = normalized.split('\n');
  if (normalized.endsWith('\n')) {
    lines.pop();
  }
  return lines;
}

function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}
