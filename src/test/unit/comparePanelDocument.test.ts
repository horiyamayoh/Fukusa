import * as assert from 'assert';
import * as vscode from 'vscode';

import { NWayCompareSession, RepoContext, SessionViewState } from '../../adapters/common/types';
import { RepositoryRegistry } from '../../application/repositoryRegistry';
import { SessionAlignmentService } from '../../application/sessionAlignmentService';
import { UriFactory } from '../../infrastructure/fs/uriFactory';
import { buildComparePanelViewModel } from '../../presentation/compare/comparePanelDocument';

suite('Unit: ComparePanelDocument', () => {
  test('builds a base-mode panel model with non-adjacent pair actions', () => {
    const alignment = new SessionAlignmentService().buildState([
      createSource(0, 'A', 'one\ntwo'),
      createSource(1, 'B', 'one\ntwo'),
      createSource(2, 'C', 'one\nTHREE')
    ]);
    const session = createSession(alignment, 'base');
    const viewState = createViewState(2, '0:2');

    const viewModel = buildComparePanelViewModel(session, viewState);
    const changedRow = viewModel.rows[1];

    assert.deepStrictEqual(viewModel.pairs.map((pair) => pair.key), ['0:1', '0:2']);
    assert.strictEqual(viewModel.pairProjectionLabel, 'base');
    assert.strictEqual(viewModel.activePairLabel, 'A-C');
    assert.strictEqual(viewModel.columns[2].isActive, true);
    assert.strictEqual(changedRow.kind, 'data');
    assert.ok(changedRow.cells[0].classNames.includes('cell--active-modified'));
    assert.ok(changedRow.cells[2].classNames.includes('cell--active-modified'));
  });

  test('builds an all-pairs panel model with every visible pair action', () => {
    const alignment = new SessionAlignmentService().buildState([
      createSource(0, 'A', 'one\ntwo'),
      createSource(1, 'B', 'one\nTWO'),
      createSource(2, 'C', 'one\nTHREE')
    ]);
    const session = createSession(alignment, 'all');
    const viewState = createViewState(1, '1:2');

    const viewModel = buildComparePanelViewModel(session, viewState);

    assert.strictEqual(viewModel.pairProjectionLabel, 'all');
    assert.deepStrictEqual(viewModel.pairs.map((pair) => pair.key), ['0:1', '0:2', '1:2']);
    assert.strictEqual(viewModel.pairs[2].isActive, true);
  });

  test('builds gap rows when unchanged regions are collapsed', () => {
    const alignment = new SessionAlignmentService().buildState([
      createSource(0, 'A', '1\n2\n3\n4\n5\n6\n7\n8\n9'),
      createSource(1, 'B', '1\n2\n3\n4\nX\n6\n7\n8\n9'),
      createSource(2, 'C', '1\n2\n3\n4\nY\n6\n7\n8\n9')
    ]);
    const session = createSession(alignment, 'all');
    const viewState = createViewState(1, '1:2');

    const viewModel = buildComparePanelViewModel(session, viewState, {
      collapseUnchanged: true,
      contextLineCount: 1,
      minimumCollapsedRows: 2
    });

    assert.strictEqual(viewModel.collapseUnchanged, true);
    assert.strictEqual(viewModel.totalRowCount, 9);
    assert.strictEqual(viewModel.hiddenRowCount, 6);
    assert.strictEqual(viewModel.collapsedGapCount, 2);
    assert.strictEqual(viewModel.expandedGapCount, 0);
    assert.deepStrictEqual(viewModel.rows.map((row) => row.kind), ['gap', 'data', 'data', 'data', 'gap']);
    assert.strictEqual(viewModel.rows[0].kind, 'gap');
    assert.strictEqual(viewModel.rows[0].hiddenRowCount, 3);
    assert.strictEqual(viewModel.rows[0].label, 'Show 3 unchanged rows (1-3)');
  });

  test('tracks expanded gap count separately from remaining collapsed gaps', () => {
    const alignment = new SessionAlignmentService().buildState([
      createSource(0, 'A', '1\n2\n3\n4\n5\n6\n7\n8\n9'),
      createSource(1, 'B', '1\n2\n3\n4\nX\n6\n7\n8\n9'),
      createSource(2, 'C', '1\n2\n3\n4\nY\n6\n7\n8\n9')
    ]);
    const session = createSession(alignment, 'all');
    const viewState = createViewState(1, '1:2');

    const viewModel = buildComparePanelViewModel(session, viewState, {
      collapseUnchanged: true,
      contextLineCount: 1,
      minimumCollapsedRows: 2,
      expandedGapKeys: ['1:3']
    });

    assert.strictEqual(viewModel.collapsedGapCount, 1);
    assert.strictEqual(viewModel.expandedGapCount, 1);
  });
});

function createSource(revisionIndex: number, revisionId: string, text: string) {
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

function createSession(
  alignment: ReturnType<SessionAlignmentService['buildState']>,
  pairProjectionMode: 'adjacent' | 'base' | 'all'
): NWayCompareSession {
  const uriFactory = new UriFactory(new RepositoryRegistry());
  const repo: RepoContext = {
    kind: 'git',
    repoRoot: 'c:/repo',
    repoId: 'repo123'
  };

  return {
    id: 'panel-session',
    uri: uriFactory.createSessionUri('panel-session', 'src/sample.ts'),
    repo,
    originalUri: vscode.Uri.file('c:/repo/src/sample.ts'),
    relativePath: 'src/sample.ts',
    revisions: [
      { id: 'A', shortLabel: 'A' },
      { id: 'B', shortLabel: 'B' },
      { id: 'C', shortLabel: 'C' }
    ],
    createdAt: Date.now(),
    rowCount: alignment.rowCount,
    rawSnapshots: alignment.rawSnapshots,
    globalRows: alignment.globalRows,
    adjacentPairs: alignment.adjacentPairs,
    pairProjection: { mode: pairProjectionMode },
    surfaceMode: 'panel'
  };
}

function createViewState(activeRevisionIndex: number, activePairKey: string): SessionViewState {
  return {
    activeRevisionIndex,
    activePairKey,
    pageStart: 0
  };
}
