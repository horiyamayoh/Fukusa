import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';

import { NWayCompareSession, RepoContext, RevisionRef } from '../../adapters/common/types';
import { CommandContext } from '../../commands/commandContext';
import { createSwitchCompareSurfaceCommand } from '../../commands/switchCompareSurface';
import { SessionService } from '../../application/sessionService';
import { RepositoryRegistry } from '../../application/repositoryRegistry';
import { UriFactory } from '../../infrastructure/fs/uriFactory';

suite('Unit: switchCompareSurface', () => {
  teardown(() => {
    sinon.restore();
  });

  test('switches the active session to the selected compare surface', async () => {
    const sessionService = new SessionService();
    sessionService.createBrowserSession(createSession('switch-surface', createRevisions(3), 'native'));
    const switchSessionSurfaceStub = sinon.stub().resolves(true);
    sinon.stub(vscode.window, 'showQuickPick').resolves({
      surfaceMode: 'panel'
    } as never);

    await createSwitchCompareSurfaceCommand(createContext(sessionService, switchSessionSurfaceStub))();

    assert.strictEqual(switchSessionSurfaceStub.callCount, 1);
    assert.deepStrictEqual(switchSessionSurfaceStub.firstCall.args, ['switch-surface', 'panel']);
  });

  test('can switch an explicitly targeted session surface', async () => {
    const sessionService = new SessionService();
    const firstSession = sessionService.createBrowserSession(createSession('switch-surface-first', createRevisions(3), 'native'));
    sessionService.createBrowserSession(createSession('switch-surface-second', createRevisions(3), 'panel'));
    const switchSessionSurfaceStub = sinon.stub().resolves(true);
    sinon.stub(vscode.window, 'showQuickPick').resolves({
      surfaceMode: 'panel'
    } as never);

    await createSwitchCompareSurfaceCommand(createContext(sessionService, switchSessionSurfaceStub))(firstSession.id);

    assert.strictEqual(switchSessionSurfaceStub.callCount, 1);
    assert.deepStrictEqual(switchSessionSurfaceStub.firstCall.args, [firstSession.id, 'panel']);
  });
});

function createContext(
  sessionService: SessionService,
  switchSessionSurfaceStub: sinon.SinonStub
): CommandContext {
  return {
    output: { info: sinon.stub() } as never,
    repositoryService: {} as never,
    revisionPickerService: {} as never,
    uriFactory: {} as never,
    compatibilityService: {} as never,
    sessionBuilderService: {} as never,
    sessionService,
    compareSessionController: {
      switchSessionSurface: switchSessionSurfaceStub
    } as never,
    cacheService: {} as never,
    blameDecorationController: {} as never
  } as unknown as CommandContext;
}

function createSession(
  sessionId: string,
  revisions: readonly RevisionRef[],
  surfaceMode: 'native' | 'panel'
): NWayCompareSession {
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
    surfaceMode
  };
}

function createRevisions(count: number): RevisionRef[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `rev-${index}`,
    shortLabel: `r${index}`
  }));
}
