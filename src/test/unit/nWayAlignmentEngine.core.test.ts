import * as assert from 'assert';

import { buildCanonicalRows } from '../../application/nWayAlignmentEngine';

suite('Unit: nWayAlignmentEngine', () => {
  test('returns no rows when no source documents are provided', () => {
    assert.deepStrictEqual(buildCanonicalRows([]), []);
  });

  test('keeps identical rows aligned across all revisions', () => {
    const rows = buildCanonicalRows([
      ['alpha', 'beta'],
      ['alpha', 'beta'],
      ['alpha', 'beta']
    ]);

    assert.strictEqual(rows.length, 2);
    assert.deepStrictEqual(rows[1], {
      entries: [
        { lineNumber: 2, text: 'beta' },
        { lineNumber: 2, text: 'beta' },
        { lineNumber: 2, text: 'beta' }
      ]
    });
  });

  test('aligns whitespace-only replacements as modified rows instead of insert-delete pairs', () => {
    const rows = buildCanonicalRows([
      ['const  value = 1;'],
      ['const value = 1;']
    ]);

    assert.deepStrictEqual(rows, [{
      entries: [
        { lineNumber: 1, text: 'const  value = 1;' },
        { lineNumber: 1, text: 'const value = 1;' }
      ]
    }]);
  });

  test('uses character similarity for short and unicode lines', () => {
    const unicodeRows = buildCanonicalRows([
      ['\u732b'],
      ['\u732b!']
    ]);
    const shortRows = buildCanonicalRows([
      ['a'],
      ['ab']
    ]);

    assert.strictEqual(unicodeRows.length, 1);
    assert.strictEqual(unicodeRows[0]?.entries[0]?.text, '\u732b');
    assert.strictEqual(unicodeRows[0]?.entries[1]?.text, '\u732b!');
    assert.strictEqual(shortRows.length, 1);
    assert.strictEqual(shortRows[0]?.entries[0]?.text, 'a');
    assert.strictEqual(shortRows[0]?.entries[1]?.text, 'ab');
  });

  test('preserves progressive n-way alignment when later revisions add leading rows', () => {
    const rows = buildCanonicalRows([
      ['alpha', 'beta', 'gamma'],
      ['alpha', 'beta changed', 'gamma'],
      ['intro', 'alpha', 'beta changed', 'gamma']
    ]);

    assert.strictEqual(rows.length, 4);
    assert.deepStrictEqual(rows[0], {
      entries: [
        undefined,
        undefined,
        { lineNumber: 1, text: 'intro' }
      ]
    });
    assert.deepStrictEqual(rows[2], {
      entries: [
        { lineNumber: 2, text: 'beta' },
        { lineNumber: 2, text: 'beta changed' },
        { lineNumber: 3, text: 'beta changed' }
      ]
    });
  });

  test('falls back to the large-block matcher for oversized replacement hunks', () => {
    const left = Array.from({ length: 1300 }, (_, index) => `left-${index}`);
    const right = Array.from({ length: 1300 }, (_, index) => `right-${index}`);

    const rows = buildCanonicalRows([left, right]);

    assert.ok(rows.length >= 1300);
    assert.ok(rows.length < 2600);
    assert.strictEqual(rows[0]?.entries[0]?.lineNumber, 1);
    assert.strictEqual(rows[0]?.entries[1]?.lineNumber, 1);
    assert.strictEqual(rows.at(-1)?.entries[0]?.lineNumber, 1300);
    assert.strictEqual(rows.at(-1)?.entries[1]?.lineNumber, 1300);
  });
});
