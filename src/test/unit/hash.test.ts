import * as assert from 'assert';

import { stableHash } from '../../util/hash';

suite('Unit: stableHash', () => {
  test('returns a stable hash for the same input', () => {
    const first = stableHash('c:/repo/path');
    const second = stableHash('c:/repo/path');

    assert.strictEqual(first, second);
    assert.strictEqual(first.length, 12);
  });
});
