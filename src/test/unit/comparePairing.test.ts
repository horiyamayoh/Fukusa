import * as assert from 'assert';

import {
  deriveActivePairKey,
  getPairOverlay,
  getVisiblePairKeys,
  normalizePairProjection
} from '../../application/comparePairing';
import { createRevisions, createSession as createTestSession } from '../helpers/sessionHelpers';

suite('Unit: comparePairing', () => {
  test('normalizes custom projections by removing invalid pairs', () => {
    assert.deepStrictEqual(normalizePairProjection({
      mode: 'custom',
      pairKeys: ['0:2', '0:2', '1:4', 'bad']
    }, 4), {
      mode: 'custom',
      pairKeys: ['0:2']
    });

    assert.deepStrictEqual(normalizePairProjection({
      mode: 'custom',
      pairKeys: ['5:6']
    }, 3), {
      mode: 'adjacent'
    });
  });

  test('derives all visible pair keys for the all projection', () => {
    assert.deepStrictEqual(getVisiblePairKeys({ mode: 'all' }, {
      startRevisionIndex: 1,
      endRevisionIndex: 3
    }), ['1:2', '1:3', '2:3']);
  });

  test('chooses the nearest visible focused pair for custom projections', () => {
    const session = createTestSession('session-custom', createRevisions(4), {
      rowCount: 1,
      pairProjection: { mode: 'custom', pairKeys: ['0:2', '2:3'] },
      globalRows: [
        {
          rowNumber: 1,
          cells: createRevisions(4).map((revision, index) => ({
            revisionIndex: index,
            rowNumber: 1,
            present: true,
            text: index === 0 ? 'alpha' : index === 1 ? 'beta' : index === 2 ? 'gamma' : 'delta',
            originalLineNumber: 1
          }))
        }
      ]
    });

    assert.strictEqual(deriveActivePairKey(session, 2, {
      startRevisionIndex: 0,
      endRevisionIndex: 3,
      rawSnapshots: session.rawSnapshots
    }), '2:3');
  });

  test('memoizes computed non-adjacent overlays per session', () => {
    const session = createTestSession('session-all', createRevisions(4), {
      rowCount: 1,
      pairProjection: { mode: 'all' },
      globalRows: [
        {
          rowNumber: 1,
          cells: createRevisions(4).map((revision, index) => ({
            revisionIndex: index,
            rowNumber: 1,
            present: true,
            text: index === 0 ? 'alpha' : index === 1 ? 'beta' : index === 2 ? 'gamma' : 'delta',
            originalLineNumber: 1
          }))
        }
      ]
    });

    const first = getPairOverlay(session, '0:2');
    const second = getPairOverlay(session, '0:2');

    assert.ok(first);
    assert.strictEqual(first, second);
  });
});
