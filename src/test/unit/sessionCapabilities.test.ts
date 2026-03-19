import * as assert from 'assert';
import * as vscode from 'vscode';

import { NWayCompareSession, RepoContext, RevisionRef } from '../../adapters/common/types';
import { getSessionCapabilityState } from '../../application/sessionCapabilities';
import { RepositoryRegistry } from '../../application/repositoryRegistry';
import { UriFactory } from '../../infrastructure/fs/uriFactory';

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

function createSession(
  sessionId: string,
  revisions: readonly RevisionRef[],
  surfaceMode: 'native' | 'panel',
  options: {
    readonly rowCount?: number;
    readonly changedRowNumbers?: readonly number[];
  } = {}
): NWayCompareSession {
  const uriFactory = new UriFactory(new RepositoryRegistry());
  const repo: RepoContext = {
    kind: 'git',
    repoRoot: 'c:/repo',
    repoId: 'repo123'
  };
  const rowCount = options.rowCount ?? 1;
  const changedRowNumbers = options.changedRowNumbers ?? [1];

  return {
    id: sessionId,
    uri: uriFactory.createSessionUri(sessionId, 'src/sample.ts'),
    repo,
    originalUri: vscode.Uri.file('c:/repo/src/sample.ts'),
    relativePath: 'src/sample.ts',
    revisions,
    createdAt: Date.now(),
    rowCount,
    rawSnapshots: revisions.map((revision, index) => ({
      snapshotUri: vscode.Uri.file(`c:/repo/.fukusa-shadow/revisions/${revision.id}/src/sample.ts`),
      rawUri: vscode.Uri.file(`c:/repo/.fukusa-shadow/revisions/${revision.id}/src/sample.ts`),
      revisionIndex: index,
      revisionId: revision.id,
      revisionLabel: revision.shortLabel,
      relativePath: 'src/sample.ts',
      lineMap: {
        rowToOriginalLine: new Map([[1, 1]]),
        originalLineToRow: new Map([[1, 1]])
      }
    })),
    globalRows: Array.from({ length: rowCount }, (_, rowIndex) => ({
      rowNumber: rowIndex + 1,
      cells: revisions.map((revision, index) => ({
        revisionIndex: index,
        rowNumber: rowIndex + 1,
        present: true,
        text: `${revision.id}-${rowIndex + 1}`,
        originalLineNumber: rowIndex + 1
      }))
    })),
    adjacentPairs: revisions.slice(0, -1).map((revision, index) => ({
      key: `${index}:${index + 1}`,
      leftRevisionIndex: index,
      rightRevisionIndex: index + 1,
      label: `${revision.shortLabel}-${revisions[index + 1].shortLabel}`,
      changedRowNumbers
    })),
    pairProjection: { mode: 'adjacent' },
    surfaceMode
  };
}

function createRevisions(count: number): RevisionRef[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `rev-${index}`,
    shortLabel: `r${index}`
  }));
}
