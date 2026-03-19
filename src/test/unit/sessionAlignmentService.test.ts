import * as assert from 'assert';
import * as vscode from 'vscode';

import { CompareSourceDocument } from '../../adapters/common/types';
import { SessionAlignmentService } from '../../application/sessionAlignmentService';

suite('Unit: SessionAlignmentService', () => {
  function createService(): SessionAlignmentService {
    return new SessionAlignmentService();
  }

  function createSource(revisionIndex: number, revisionId: string, text: string): CompareSourceDocument {
    return {
      revisionIndex,
      revisionId,
      revisionLabel: revisionId,
      relativePath: 'src/sample.ts',
      snapshotUri: vscode.Uri.file(`c:/repo/${revisionId}.snapshot.ts`),
      rawUri: vscode.Uri.file(`c:/repo/${revisionId}.raw.ts`),
      text
    };
  }

  test('keeps all revisions at the same aligned row count without duplicating middle columns', () => {
    const service = createService();
    const state = service.buildState([
      createSource(0, 'A', 'top\nshared'),
      createSource(1, 'B', 'shared'),
      createSource(2, 'C', 'top\nshared')
    ]);

    assert.strictEqual(state.rowCount, 2);
    assert.strictEqual(state.globalRows.length, 2);
    assert.deepStrictEqual(state.globalRows.map((row) => row.cells.map((cell) => ({ present: cell.present, text: cell.text }))), [
      [
        { present: true, text: 'top' },
        { present: false, text: '' },
        { present: true, text: 'top' }
      ],
      [
        { present: true, text: 'shared' },
        { present: true, text: 'shared' },
        { present: true, text: 'shared' }
      ]
    ]);
  });

  test('tracks middle revision changes independently against previous and next pairs', () => {
    const service = createService();
    const state = service.buildState([
      createSource(0, 'A', '1\n2\n3\n4'),
      createSource(1, 'B', '1\n2\nX\n3\n4'),
      createSource(2, 'C', '1\n2\nY\n3\n4')
    ]);

    const row = state.globalRows[2].cells[1];
    assert.strictEqual(row.present, true);
    assert.strictEqual(row.text, 'X');
    assert.strictEqual(row.prevChange?.kind, 'added');
    assert.strictEqual(row.nextChange?.kind, 'modified');
    assert.strictEqual(row.nextChange?.counterpartText, 'Y');

    const leftPlaceholder = state.globalRows[2].cells[0];
    assert.strictEqual(leftPlaceholder.present, false);
    assert.strictEqual(leftPlaceholder.nextChange?.kind, 'added');
    assert.strictEqual(leftPlaceholder.nextChange?.counterpartText, 'X');
  });

  test('keeps removed then re-added rows as placeholders in the middle revision', () => {
    const service = createService();
    const state = service.buildState([
      createSource(0, 'A', 'a\nb\nc\nd'),
      createSource(1, 'B', 'a\nc\nd'),
      createSource(2, 'C', 'a\nb\nc\nd')
    ]);

    const middlePlaceholder = state.globalRows[1].cells[1];
    assert.strictEqual(middlePlaceholder.present, false);
    assert.strictEqual(middlePlaceholder.prevChange?.kind, 'removed');
    assert.strictEqual(middlePlaceholder.prevChange?.counterpartText, 'b');
    assert.strictEqual(middlePlaceholder.nextChange?.kind, 'added');
    assert.strictEqual(middlePlaceholder.nextChange?.counterpartText, 'b');
  });

  test('builds snapshot line maps from global rows back to original line numbers', () => {
    const service = createService();
    const state = service.buildState([
      createSource(0, 'A', 'alpha\nbeta\ngamma'),
      createSource(1, 'B', 'alpha\ninserted\nbeta\ngamma')
    ]);

    assert.deepStrictEqual([...state.rawSnapshots[0].lineMap.rowToOriginalLine.entries()], [
      [1, 1],
      [3, 2],
      [4, 3]
    ]);
    assert.deepStrictEqual([...state.rawSnapshots[1].lineMap.originalLineToRow.entries()], [
      [1, 1],
      [2, 2],
      [3, 3],
      [4, 4]
    ]);
  });

  test('marks intraline changes for modified rows', () => {
    const service = createService();
    const state = service.buildState([
      createSource(0, 'A', 'const value = 1;'),
      createSource(1, 'B', 'const total = 10;')
    ]);

    const leftCell = state.globalRows[0].cells[0];
    const rightCell = state.globalRows[0].cells[1];
    assert.strictEqual(leftCell.nextChange?.kind, 'modified');
    assert.strictEqual(rightCell.prevChange?.kind, 'modified');
    assert.ok((leftCell.nextChange?.intralineSegments.length ?? 0) > 0);
    assert.ok((rightCell.prevChange?.intralineSegments.length ?? 0) > 0);
  });

  test('does not create phantom aligned rows for files ending with a trailing newline', () => {
    const service = createService();
    const state = service.buildState([
      createSource(0, 'A', 'one\ntwo\nthree\n'),
      createSource(1, 'B', 'one\ntwo changed\nthree\nfour\n')
    ]);

    assert.strictEqual(state.rowCount, 4);
    assert.deepStrictEqual(state.globalRows.map((row) => row.cells[0].originalLineNumber), [1, 2, 3, undefined]);
    assert.deepStrictEqual(state.globalRows.map((row) => row.cells[1].originalLineNumber), [1, 2, 3, 4]);
    assert.strictEqual(state.globalRows[3].cells[0].present, false);
    assert.strictEqual(state.globalRows[3].cells[1].text, 'four');
  });

  test('builds adjacent pair overlays and defaults selection to the first pair', () => {
    const service = createService();
    const state = service.buildState([
      createSource(0, 'A', 'one\ntwo'),
      createSource(1, 'B', 'one\nTWO'),
      createSource(2, 'C', 'one\nTHREE')
    ]);

    assert.deepStrictEqual(state.adjacentPairs.map((pair) => pair.key), ['0:1', '1:2']);
    assert.strictEqual(state.rawSnapshots.length, 3);
    assert.deepStrictEqual(state.adjacentPairs.map((pair) => pair.changedRowNumbers), [[2], [2]]);
  });

  test('aligns inserted lines inside replacement hunks around the most similar surviving line', () => {
    const service = createService();
    const state = service.buildState([
      createSource(0, 'A', 'const x = 1;\nreturn x;'),
      createSource(1, 'B', 'const x = 1;\nconst y = 2;\nreturn x + y;'),
      createSource(2, 'C', 'const x = 1;\nconst y = 2;\nreturn x + y + 1;')
    ]);

    assert.strictEqual(state.rowCount, 3);
    assert.deepStrictEqual(state.globalRows.map((row) => row.cells.map((cell) => ({ present: cell.present, text: cell.text }))), [
      [
        { present: true, text: 'const x = 1;' },
        { present: true, text: 'const x = 1;' },
        { present: true, text: 'const x = 1;' }
      ],
      [
        { present: false, text: '' },
        { present: true, text: 'const y = 2;' },
        { present: true, text: 'const y = 2;' }
      ],
      [
        { present: true, text: 'return x;' },
        { present: true, text: 'return x + y;' },
        { present: true, text: 'return x + y + 1;' }
      ]
    ]);

    assert.strictEqual(state.globalRows[1].cells[0].nextChange?.kind, 'added');
    assert.strictEqual(state.globalRows[2].cells[1].prevChange?.kind, 'modified');
    assert.strictEqual(state.globalRows[2].cells[2].prevChange?.kind, 'modified');
  });
});
