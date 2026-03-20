import * as assert from 'assert';

import { getSessionCapabilityState } from '../../application/sessionCapabilities';
import { createRevisions, createSession } from '../helpers/sessionHelpers';

suite('Unit: sessionCapabilities', () => {
  test('derives capability flags and visible window labels from session state', () => {
    const session = createSession('capability-session', createRevisions(11), 'native', {
      rowCount: 20,
      changedRowNumbers: [10]
    });

    let state = getSessionCapabilityState(session, {
      activeRevisionIndex: 0,
      activePairKey: '0:1',
      pageStart: 0
    }, {
      collapseUnchanged: false,
      expandedGapKeys: []
    });

    assert.strictEqual(state.canChangePairProjection, true);
    assert.strictEqual(state.canShiftWindow, true);
    assert.strictEqual(state.canShiftWindowLeft, false);
    assert.strictEqual(state.canShiftWindowRight, true);
    assert.strictEqual(state.hasActiveSnapshot, true);
    assert.strictEqual(state.hasActivePair, true);
    assert.strictEqual(state.activeRevisionLabel, 'r0');
    assert.strictEqual(state.activePairLabel, 'r0-r1');
    assert.strictEqual(state.hasCollapsedGaps, false);
    assert.strictEqual(state.hasExpandedGaps, false);
    assert.strictEqual(state.visibleRevisionLabel, 'window 1-9/11');

    state = getSessionCapabilityState(session, {
      activeRevisionIndex: 2,
      activePairKey: '1:2',
      pageStart: 1
    }, {
      collapseUnchanged: true,
      expandedGapKeys: ['14:20']
    });

    assert.strictEqual(state.canShiftWindowLeft, true);
    assert.strictEqual(state.canShiftWindowRight, true);
    assert.strictEqual(state.hasActiveSnapshot, true);
    assert.strictEqual(state.hasActivePair, true);
    assert.strictEqual(state.activeRevisionLabel, 'r2');
    assert.strictEqual(state.activePairLabel, 'r1-r2');
    assert.strictEqual(state.collapseUnchanged, true);
    assert.strictEqual(state.hasCollapsedGaps, true);
    assert.strictEqual(state.hasExpandedGaps, true);
    assert.strictEqual(state.visibleRevisionLabel, 'window 2-10/11');
  });

  test('reports full coverage labels for panel sessions', () => {
    const session = createSession('capability-panel-session', createRevisions(4), 'panel');
    const state = getSessionCapabilityState(session, {
      activeRevisionIndex: 0,
      activePairKey: undefined,
      pageStart: 0
    }, {
      collapseUnchanged: false,
      expandedGapKeys: []
    });

    assert.strictEqual(state.canShiftWindow, false);
    assert.strictEqual(state.canShiftWindowLeft, false);
    assert.strictEqual(state.canShiftWindowRight, false);
    assert.strictEqual(state.hasActiveSnapshot, true);
    assert.strictEqual(state.hasActivePair, true);
    assert.strictEqual(state.activeRevisionLabel, 'r0');
    assert.strictEqual(state.activePairLabel, 'r0-r1');
    assert.strictEqual(state.visibleRevisionLabel, 'all 4 revisions');
  });

  test('reports when no active pair exists for the session', () => {
    const session = createSession('capability-single-session', createRevisions(1), 'native');
    const state = getSessionCapabilityState(session, {
      activeRevisionIndex: 0,
      activePairKey: undefined,
      pageStart: 0
    }, {
      collapseUnchanged: false,
      expandedGapKeys: []
    });

    assert.strictEqual(state.hasActiveSnapshot, true);
    assert.strictEqual(state.hasActivePair, false);
    assert.strictEqual(state.activeRevisionLabel, 'r0');
    assert.strictEqual(state.activePairLabel, undefined);
  });
});
