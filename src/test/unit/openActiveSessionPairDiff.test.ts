import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';

import { NWayCompareSession, RepoContext, RevisionRef } from '../../adapters/common/types';
import { RepositoryRegistry } from '../../application/repositoryRegistry';
import { SessionService } from '../../application/sessionService';
import { CommandContext } from '../../commands/commandContext';
import { createOpenActiveSessionPairDiffCommand } from '../../commands/openActiveSessionPairDiff';
import { UriFactory } from '../../infrastructure/fs/uriFactory';

suite('Unit: openActiveSessionPairDiff', () => {
  teardown(() => {
    sinon.restore();
  });

  test('opens the active pair for an explicitly targeted session and marks it active', async () => {
    const sessionService = new SessionService();
    const firstSession = sessionService.createBrowserSession(createSession('pair-first', createRevisions(3)));
    sessionService.createBrowserSession(createSession('pair-second', createRevisions(3)));
    sessionService.setActivePair(firstSession.id, '1:2');
    const executeCommandStub = sinon.stub(vscode.commands, 'executeCommand').resolves(undefined);

    await createOpenActiveSessionPairDiffCommand(createContext(sessionService))(firstSession.id);

    assert.strictEqual(sessionService.getActiveBrowserSession()?.id, firstSession.id);
    assert.strictEqual(sessionService.getSessionViewState(firstSession.id).activePairKey, '1:2');
    assert.strictEqual(executeCommandStub.firstCall.args[0], 'vscode.diff');
    assert.strictEqual((executeCommandStub.firstCall.args[1] as vscode.Uri).toString(), firstSession.rawSnapshots[1].rawUri.toString());
    assert.strictEqual((executeCommandStub.firstCall.args[2] as vscode.Uri).toString(), firstSession.rawSnapshots[2].rawUri.toString());
  });
});

function createContext(sessionService: SessionService): CommandContext {
  return {
    output: { info: sinon.stub() } as never,
    repositoryService: {} as never,
    revisionPickerService: {} as never,
    uriFactory: {} as never,
    compatibilityService: {} as never,
    sessionBuilderService: {} as never,
    sessionService,
    compareSessionController: {} as never,
    cacheService: {} as never,
    blameDecorationController: {} as never
  } as unknown as CommandContext;
}

function createSession(sessionId: string, revisions: readonly RevisionRef[]): NWayCompareSession {
  const uriFactory = new UriFactory(new RepositoryRegistry());
  const repo: RepoContext = {
    kind: 'git',
    repoRoot: 'c:/repo',
    repoId: 'repo123'
  };

  return {
    id: sessionId,
    uri: uriFactory.createSessionUri(sessionId, 'src/sample.ts'),
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
    globalRows: [{
      rowNumber: 1,
      cells: revisions.map((revision, index) => ({
        revisionIndex: index,
        rowNumber: 1,
        present: true,
        text: revision.id,
        originalLineNumber: 1
      }))
    }],
    adjacentPairs: revisions.slice(0, -1).map((revision, index) => ({
      key: `${index}:${index + 1}`,
      leftRevisionIndex: index,
      rightRevisionIndex: index + 1,
      label: `${revision.shortLabel}-${revisions[index + 1].shortLabel}`,
      changedRowNumbers: [1]
    })),
    pairProjection: { mode: 'adjacent' },
    surfaceMode: 'native'
  };
}

function createRevisions(count: number): RevisionRef[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `rev-${index}`,
    shortLabel: `r${index}`
  }));
}
