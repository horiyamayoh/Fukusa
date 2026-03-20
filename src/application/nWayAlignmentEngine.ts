import { diffLines } from 'diff';

/**
 * A single canonical line entry from one source document.
 */
export interface CanonicalEntry {
  readonly lineNumber: number;
  readonly text: string;
}

/**
 * A row in the canonical N-way alignment table.
 */
export interface CanonicalRow {
  readonly entries: Array<CanonicalEntry | undefined>;
}

interface PairAlignmentRow {
  readonly left?: CanonicalEntry;
  readonly right?: CanonicalEntry;
}

interface PreparedLine {
  readonly text: string;
  readonly normalizedText: string;
  readonly bigrams: ReadonlyMap<string, number>;
}

const MATCH_SIMILARITY_THRESHOLD = 0.3;
const MATCH_LOOKAHEAD = 6;
const MAX_ALIGNMENT_MATRIX_CELLS = 1_500_000;
const EXACT_TEXT_MATCH_SCORE = 100;
const NORMALIZED_TEXT_MATCH_SCORE = 95;
const SIMILARITY_PERCENT_SCALE = 100;

/**
 * Builds canonical rows across every revision source in order.
 */
export function buildCanonicalRows(linesBySource: readonly string[][]): CanonicalRow[] {
  const documentCount = linesBySource.length;
  if (documentCount === 0) {
    return [];
  }

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
  const preparedLeftLines = leftLines.map(prepareLine);
  const preparedRightLines = rightLines.map(prepareLine);
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
      const removedPrepared = preparedLeftLines.slice(leftLineNumber - 1, leftLineNumber - 1 + removedLines.length);
      const addedPrepared = preparedRightLines.slice(rightLineNumber - 1, rightLineNumber - 1 + addedLines.length);

      rows.push(...alignReplacementBlock(
        removedLines,
        addedLines,
        removedPrepared,
        addedPrepared,
        leftLineNumber,
        rightLineNumber
      ));

      leftLineNumber += removedLines.length;
      rightLineNumber += addedLines.length;
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

function alignReplacementBlock(
  removedLines: readonly string[],
  addedLines: readonly string[],
  removedPrepared: readonly PreparedLine[],
  addedPrepared: readonly PreparedLine[],
  leftStartLineNumber: number,
  rightStartLineNumber: number
): PairAlignmentRow[] {
  const matches = selectReplacementMatches(removedPrepared, addedPrepared);
  const rows: PairAlignmentRow[] = [];
  let leftIndex = 0;
  let rightIndex = 0;

  for (const match of matches) {
    while (leftIndex < match.leftIndex) {
      rows.push({
        left: {
          lineNumber: leftStartLineNumber + leftIndex,
          text: removedLines[leftIndex]
        }
      });
      leftIndex += 1;
    }

    while (rightIndex < match.rightIndex) {
      rows.push({
        right: {
          lineNumber: rightStartLineNumber + rightIndex,
          text: addedLines[rightIndex]
        }
      });
      rightIndex += 1;
    }

    rows.push({
      left: {
        lineNumber: leftStartLineNumber + match.leftIndex,
        text: removedLines[match.leftIndex]
      },
      right: {
        lineNumber: rightStartLineNumber + match.rightIndex,
        text: addedLines[match.rightIndex]
      }
    });
    leftIndex = match.leftIndex + 1;
    rightIndex = match.rightIndex + 1;
  }

  while (leftIndex < removedLines.length) {
    rows.push({
      left: {
        lineNumber: leftStartLineNumber + leftIndex,
        text: removedLines[leftIndex]
      }
    });
    leftIndex += 1;
  }

  while (rightIndex < addedLines.length) {
    rows.push({
      right: {
        lineNumber: rightStartLineNumber + rightIndex,
        text: addedLines[rightIndex]
      }
    });
    rightIndex += 1;
  }

  return rows;
}

function selectReplacementMatches(
  removedPrepared: readonly PreparedLine[],
  addedPrepared: readonly PreparedLine[]
): ReadonlyArray<{ readonly leftIndex: number; readonly rightIndex: number }> {
  if (removedPrepared.length === 0 || addedPrepared.length === 0) {
    return [];
  }

  if (removedPrepared.length === 1 && addedPrepared.length === 1) {
    return [{
      leftIndex: 0,
      rightIndex: 0
    }];
  }

  return removedPrepared.length * addedPrepared.length <= MAX_ALIGNMENT_MATRIX_CELLS
    ? buildOptimalReplacementMatches(removedPrepared, addedPrepared)
    : buildGreedyReplacementMatches(removedPrepared, addedPrepared);
}

function buildOptimalReplacementMatches(
  removedPrepared: readonly PreparedLine[],
  addedPrepared: readonly PreparedLine[]
): ReadonlyArray<{ readonly leftIndex: number; readonly rightIndex: number }> {
  const width = addedPrepared.length + 1;
  const scores = new Uint32Array((removedPrepared.length + 1) * width);
  const directions = new Uint8Array((removedPrepared.length + 1) * width);

  for (let leftIndex = 1; leftIndex <= removedPrepared.length; leftIndex += 1) {
    for (let rightIndex = 1; rightIndex <= addedPrepared.length; rightIndex += 1) {
      const currentIndex = leftIndex * width + rightIndex;
      const upScore = scores[currentIndex - width];
      const leftScore = scores[currentIndex - 1];

      let bestScore = upScore;
      let bestDirection = 1;

      if (leftScore > bestScore) {
        bestScore = leftScore;
        bestDirection = 2;
      }

      const matchScore = scoreLinePair(removedPrepared[leftIndex - 1], addedPrepared[rightIndex - 1]);
      if (matchScore > 0) {
        const diagonalScore = scores[currentIndex - width - 1] + matchScore;
        if (diagonalScore >= bestScore) {
          bestScore = diagonalScore;
          bestDirection = 3;
        }
      }

      scores[currentIndex] = bestScore;
      directions[currentIndex] = bestDirection;
    }
  }

  const matches: Array<{ leftIndex: number; rightIndex: number }> = [];
  let leftIndex = removedPrepared.length;
  let rightIndex = addedPrepared.length;

  while (leftIndex > 0 && rightIndex > 0) {
    const currentIndex = leftIndex * width + rightIndex;
    const direction = directions[currentIndex];

    if (direction === 3) {
      matches.push({
        leftIndex: leftIndex - 1,
        rightIndex: rightIndex - 1
      });
      leftIndex -= 1;
      rightIndex -= 1;
      continue;
    }

    if (direction === 2) {
      rightIndex -= 1;
      continue;
    }

    leftIndex -= 1;
  }

  matches.reverse();
  return matches;
}

function buildGreedyReplacementMatches(
  removedPrepared: readonly PreparedLine[],
  addedPrepared: readonly PreparedLine[]
): ReadonlyArray<{ readonly leftIndex: number; readonly rightIndex: number }> {
  const matches: Array<{ leftIndex: number; rightIndex: number }> = [];
  let leftStart = 0;
  let rightStart = 0;

  while (leftStart < removedPrepared.length && rightStart < addedPrepared.length) {
    let bestMatch:
      | { readonly leftIndex: number; readonly rightIndex: number; readonly score: number; readonly distance: number }
      | undefined;

    const maxLeft = Math.min(removedPrepared.length, leftStart + MATCH_LOOKAHEAD);
    const maxRight = Math.min(addedPrepared.length, rightStart + MATCH_LOOKAHEAD);
    for (let leftIndex = leftStart; leftIndex < maxLeft; leftIndex += 1) {
      for (let rightIndex = rightStart; rightIndex < maxRight; rightIndex += 1) {
        const score = scoreLinePair(removedPrepared[leftIndex], addedPrepared[rightIndex]);
        if (score === 0) {
          continue;
        }

        const distance = (leftIndex - leftStart) + (rightIndex - rightStart);
        if (
          !bestMatch
          || score > bestMatch.score
          || (score === bestMatch.score && distance < bestMatch.distance)
        ) {
          bestMatch = {
            leftIndex,
            rightIndex,
            score,
            distance
          };
        }
      }
    }

    if (!bestMatch) {
      if ((removedPrepared.length - leftStart) >= (addedPrepared.length - rightStart)) {
        leftStart += 1;
      } else {
        rightStart += 1;
      }
      continue;
    }

    matches.push({
      leftIndex: bestMatch.leftIndex,
      rightIndex: bestMatch.rightIndex
    });
    leftStart = bestMatch.leftIndex + 1;
    rightStart = bestMatch.rightIndex + 1;
  }

  return matches;
}

function scoreLinePair(left: PreparedLine, right: PreparedLine): number {
  if (left.text === right.text) {
    return EXACT_TEXT_MATCH_SCORE;
  }

  if (left.normalizedText === right.normalizedText) {
    return NORMALIZED_TEXT_MATCH_SCORE;
  }

  const similarity = computeSimilarity(left, right);
  if (similarity < MATCH_SIMILARITY_THRESHOLD) {
    return 0;
  }

  return Math.max(1, Math.round(similarity * SIMILARITY_PERCENT_SCALE));
}

function computeSimilarity(left: PreparedLine, right: PreparedLine): number {
  if (left.normalizedText.length === 0 || right.normalizedText.length === 0) {
    return 0;
  }

  if (left.normalizedText.length === 1 || right.normalizedText.length === 1) {
    return computeCharacterDice(left.normalizedText, right.normalizedText);
  }

  const intersection = countMapIntersection(left.bigrams, right.bigrams);
  const total = countMapValues(left.bigrams) + countMapValues(right.bigrams);
  return total === 0 ? 0 : (2 * intersection) / total;
}

function computeCharacterDice(left: string, right: string): number {
  const leftCounts = buildCharacterCounts(left);
  const rightCounts = buildCharacterCounts(right);
  const intersection = countMapIntersection(leftCounts, rightCounts);
  const total = left.length + right.length;
  return total === 0 ? 0 : (2 * intersection) / total;
}

function buildCharacterCounts(text: string): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const character of text) {
    counts.set(character, (counts.get(character) ?? 0) + 1);
  }
  return counts;
}

function countMapIntersection(left: ReadonlyMap<string, number>, right: ReadonlyMap<string, number>): number {
  let intersection = 0;
  for (const [key, count] of left.entries()) {
    intersection += Math.min(count, right.get(key) ?? 0);
  }

  return intersection;
}

function countMapValues(values: ReadonlyMap<string, number>): number {
  let total = 0;
  for (const count of values.values()) {
    total += count;
  }

  return total;
}

function prepareLine(text: string): PreparedLine {
  const normalizedText = normalizeComparableLine(text);
  return {
    text,
    normalizedText,
    bigrams: buildBigrams(normalizedText)
  };
}

function buildBigrams(text: string): ReadonlyMap<string, number> {
  const bigrams = new Map<string, number>();
  if (text.length < 2) {
    return bigrams;
  }

  for (let index = 0; index < text.length - 1; index += 1) {
    const bigram = text.slice(index, index + 2);
    bigrams.set(bigram, (bigrams.get(bigram) ?? 0) + 1);
  }

  return bigrams;
}

function normalizeComparableLine(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
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

function createEntries(length: number, activeIndex?: number, entry?: CanonicalEntry): Array<CanonicalEntry | undefined> {
  const entries = Array.from({ length }, () => undefined as CanonicalEntry | undefined);
  if (activeIndex !== undefined && entry) {
    entries[activeIndex] = entry;
  }
  return entries;
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
