import * as assert from 'assert';

import { bucketizeAge } from '../../application/blameService';

suite('Unit: bucketizeAge', () => {
  test('maps timestamps into age buckets', () => {
    const now = Date.parse('2026-03-14T00:00:00Z');

    assert.strictEqual(bucketizeAge(Date.parse('2026-03-01T00:00:00Z'), now), 0);
    assert.strictEqual(bucketizeAge(Date.parse('2025-12-15T00:00:00Z'), now), 1);
    assert.strictEqual(bucketizeAge(Date.parse('2025-08-01T00:00:00Z'), now), 2);
    assert.strictEqual(bucketizeAge(Date.parse('2024-10-01T00:00:00Z'), now), 3);
    assert.strictEqual(bucketizeAge(Date.parse('2023-01-01T00:00:00Z'), now), 4);
  });
});
