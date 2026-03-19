import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';

import { NWayCompareSession, RepoContext, RevisionRef } from '../../adapters/common/types';
import { RepositoryRegistry } from '../../application/repositoryRegistry';
import { SessionService } from '../../application/sessionService';
import { SessionCommandContextController } from '../../commands/sessionCommandContextController';
import { UriFactory } from '../../infrastructure/fs/uriFactory';

suite('Unit: SessionCommandContextController', () => {
  teardown(() => {
    sinon.restore();
  });

  test('publishes active session capabilities as VS Code context keys', async () => {
    const executeCommandStub = sinon.stub(vscode.commands, 'executeCommand').resolves(undefined);
    const sessionService = new SessionService();
    const controller = new SessionCommandContextController(sessionService);

    await flushAsyncWork();
    assertContextValue(executeCommandStub, 'multidiff.hasActiveSession', false);
    assertContextValue(executeCommandStub, 'multidiff.canShiftWindow', false);
    assertContextValue(executeCommandStub, 'multidiff.canShiftWindowLeft', false);
    assertContextValue(executeCommandStub, 'multidiff.canShiftWindowRight', false);

    const session = sessionService.createBrowserSession(createSession('context-session', createRevisions(11), 'native', {
      rowCount: 20,
      changedRowNumbers: [10]
    }));
    await flushAsyncWork();

    assertContextValue(executeCommandStub, 'multidiff.hasActiveSession', true);
    assertContextValue(executeCommandStub, 'multidiff.activeSurfaceIsNative', true);
    assertContextValue(executeCommandStub, 'multidiff.activeSurfaceIsPanel', false);
    assertContextValue(executeCommandStub, 'multidiff.canChangePairProjection', true);
    assertContextValue(executeCommandStub, 'multidiff.canShiftWindow', true);
    assertContextValue(executeCommandStub, 'multidiff.canShiftWindowLeft', false);
    assertContextValue(executeCommandStub, 'multidiff.canShiftWindowRight', true);
    assertContextValue(executeCommandStub, 'multidiff.hasActiveSnapshot', true);
    assertContextValue(executeCommandStub, 'multidiff.hasActivePair', true);
    assertContextValue(executeCommandStub, 'multidiff.collapseUnchangedActive', false);
    assertContextValue(executeCommandStub, 'multidiff.hasCollapsedGaps', false);
    assertContextValue(executeCommandStub, 'multidiff.hasExpandedGaps', false);

    sessionService.shiftWindow(session.id, 1);
    await flushAsyncWork();

    assertContextValue(executeCommandStub, 'multidiff.canShiftWindowLeft', true);
    assertContextValue(executeCommandStub, 'multidiff.canShiftWindowRight', true);

    sessionService.shiftWindow(session.id, 1);
    await flushAsyncWork();

    assertContextValue(executeCommandStub, 'multidiff.canShiftWindowLeft', true);
    assertContextValue(executeCommandStub, 'multidiff.canShiftWindowRight', false);

    sessionService.toggleCollapseUnchanged(session.id);
    await flushAsyncWork();

    assertContextValue(executeCommandStub, 'multidiff.collapseUnchangedActive', true);
    assertContextValue(executeCommandStub, 'multidiff.hasCollapsedGaps', true);
    assertContextValue(executeCommandStub, 'multidiff.hasExpandedGaps', false);

    sessionService.expandProjectionGap(session.id, '14:20');
    await flushAsyncWork();

    assertContextValue(executeCommandStub, 'multidiff.hasExpandedGaps', true);

    sessionService.updateSurfaceMode(session.id, 'panel');
    await flushAsyncWork();

    assertContextValue(executeCommandStub, 'multidiff.activeSurfaceIsNative', false);
    assertContextValue(executeCommandStub, 'multidiff.activeSurfaceIsPanel', true);
    assertContextValue(executeCommandStub, 'multidiff.canShiftWindow', false);
    assertContextValue(executeCommandStub, 'multidiff.canShiftWindowLeft', false);
    assertContextValue(executeCommandStub, 'multidiff.canShiftWindowRight', false);

    controller.dispose();
  });

  test('clears pair-specific context keys when the active session has no visible pair', async () => {
    const executeCommandStub = sinon.stub(vscode.commands, 'executeCommand').resolves(undefined);
    const sessionService = new SessionService();
    const controller = new SessionCommandContextController(sessionService);

    sessionService.createBrowserSession(createSession('context-single-session', createRevisions(1), 'native'));
    await flushAsyncWork();

    assertContextValue(executeCommandStub, 'multidiff.hasActiveSnapshot', true);
    assertContextValue(executeCommandStub, 'multidiff.hasActivePair', false);

    controller.dispose();
  });
});

function assertContextValue(
  executeCommandStub: sinon.SinonStub,
  contextKey: string,
  expectedValue: unknown
): void {
  const setContextCalls = executeCommandStub.getCalls()
    .filter((call) => call.args[0] === 'setContext' && call.args[1] === contextKey);
  assert.ok(setContextCalls.length > 0, `Expected context key ${contextKey} to be set.`);
  assert.strictEqual(setContextCalls.at(-1)?.args[2], expectedValue);
}

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

async function flushAsyncWork(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}
