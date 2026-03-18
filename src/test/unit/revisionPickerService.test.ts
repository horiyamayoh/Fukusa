import * as assert from 'assert';

import { applySelectionOrder } from '../../application/revisionPickerService';

suite('Unit: RevisionPickerService', () => {
  test('preserves selection order and removes deselected items', () => {
    let order = applySelectionOrder([], ['a']);
    order = applySelectionOrder(order, ['a', 'b']);
    order = applySelectionOrder(order, ['b']);
    order = applySelectionOrder(order, ['c', 'b']);

    assert.deepStrictEqual(order, ['b', 'c']);
  });
});
