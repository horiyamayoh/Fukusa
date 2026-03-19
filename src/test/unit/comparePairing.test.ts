import * as assert from 'assert';
import * as vscode from 'vscode';

import { NWayCompareSession, RepoContext, RevisionRef } from '../../adapters/common/types';
import {
  deriveActivePairKey,
  getPairOverlay,
  getVisiblePairKeys,
  normalizePairProjection
} from '../../application/comparePairing';
import { RepositoryRegistry } from '../../application/repositoryRegistry';
import { UriFactory } from '../../infrastructure/fs/uriFactory';

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
    const session = createSession('custom');

    assert.strictEqual(deriveActivePairKey(session, 2, {
      startRevisionIndex: 0,
      endRevisionIndex: 3,
      rawSnapshots: session.rawSnapshots
    }), '2:3');
  });

  test('memoizes computed non-adjacent overlays per session', () => {
    const session = createSession('all');

    const first = getPairOverlay(session, '0:2');
    const second = getPairOverlay(session, '0:2');

    assert.ok(first);
    assert.strictEqual(first, second);
  });
});

function createSession(pairProjectionMode: 'all' | 'custom'): NWayCompareSession {
  const uriFactory = new UriFactory(new RepositoryRegistry());
  const repo: RepoContext = {
    kind: 'git',
    repoRoot: 'c:/repo',
    repoId: 'repo123'
  };
  const revisions = createRevisions(4);

  return {
    id: `session-${pairProjectionMode}`,
    uri: uriFactory.createSessionUri(`session-${pairProjectionMode}`, 'src/sample.ts'),
    repo,
    originalUri: vscode.Uri.file('c:/repo/src/sample.ts'),
    relativePath: 'src/sample.ts',
    revisions,
    createdAt: Date.now(),
    rowCount: 1,
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
    globalRows: [
      {
        rowNumber: 1,
        cells: revisions.map((revision, index) => ({
          revisionIndex: index,
          rowNumber: 1,
          present: true,
          text: index === 0 ? 'alpha' : index === 1 ? 'beta' : index === 2 ? 'gamma' : 'delta',
          originalLineNumber: 1
        }))
      }
    ],
    adjacentPairs: revisions.slice(0, -1).map((revision, index) => ({
      key: `${index}:${index + 1}`,
      leftRevisionIndex: index,
      rightRevisionIndex: index + 1,
      label: `${revision.shortLabel}-${revisions[index + 1].shortLabel}`,
      changedRowNumbers: [1]
    })),
    pairProjection: pairProjectionMode === 'custom'
      ? { mode: 'custom', pairKeys: ['0:2', '2:3'] }
      : { mode: 'all' },
    surfaceMode: 'native'
  };
}

function createRevisions(count: number): RevisionRef[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `rev-${index}`,
    shortLabel: `r${index}`
  }));
}
