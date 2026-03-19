import * as assert from 'assert';

import { projectChangedRowNumbers } from '../../application/compareRowProjection';

suite('Unit: compareRowProjection', () => {
  test('returns all rows when collapse is disabled', () => {
    const result = projectChangedRowNumbers(4, [2], {
      collapseUnchanged: false
    });

    assert.strictEqual(result.hiddenRowCount, 0);
    assert.deepStrictEqual(result.rows, [
      { kind: 'data', rowNumber: 1 },
      { kind: 'data', rowNumber: 2 },
      { kind: 'data', rowNumber: 3 },
      { kind: 'data', rowNumber: 4 }
    ]);
  });

  test('collapses unchanged gaps around changed rows', () => {
    const result = projectChangedRowNumbers(9, [5], {
      collapseUnchanged: true,
      contextLineCount: 1,
      minimumCollapsedRows: 2
    });

    assert.strictEqual(result.hiddenRowCount, 6);
    assert.deepStrictEqual(result.rows, [
      { kind: 'gap', gapKey: '1:3', startRowNumber: 1, endRowNumber: 3, hiddenRowCount: 3 },
      { kind: 'data', rowNumber: 4 },
      { kind: 'data', rowNumber: 5 },
      { kind: 'data', rowNumber: 6 },
      { kind: 'gap', gapKey: '7:9', startRowNumber: 7, endRowNumber: 9, hiddenRowCount: 3 }
    ]);
  });

  test('expands explicitly opened gaps while leaving others collapsed', () => {
    const result = projectChangedRowNumbers(9, [5], {
      collapseUnchanged: true,
      contextLineCount: 1,
      minimumCollapsedRows: 2,
      expandedGapKeys: ['1:3']
    });

    assert.strictEqual(result.hiddenRowCount, 3);
    assert.deepStrictEqual(result.rows, [
      { kind: 'data', rowNumber: 1 },
      { kind: 'data', rowNumber: 2 },
      { kind: 'data', rowNumber: 3 },
      { kind: 'data', rowNumber: 4 },
      { kind: 'data', rowNumber: 5 },
      { kind: 'data', rowNumber: 6 },
      { kind: 'gap', gapKey: '7:9', startRowNumber: 7, endRowNumber: 9, hiddenRowCount: 3 }
    ]);
  });

  test('collapses an entirely unchanged document into one gap', () => {
    const result = projectChangedRowNumbers(5, [], {
      collapseUnchanged: true
    });

    assert.deepStrictEqual(result.rows, [
      { kind: 'gap', gapKey: '1:5', startRowNumber: 1, endRowNumber: 5, hiddenRowCount: 5 }
    ]);
  });
});
