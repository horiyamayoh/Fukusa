import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';

import { NWayCompareSession, RepoContext, RevisionRef } from '../../adapters/common/types';
import { CommandContext } from '../../commands/commandContext';
import { createChangePairProjectionCommand } from '../../commands/changePairProjection';
import { SessionService } from '../../application/sessionService';
import { RepositoryRegistry } from '../../application/repositoryRegistry';
import { UriFactory } from '../../infrastructure/fs/uriFactory';

suite('Unit: changePairProjection', () => {
  teardown(() => {
    sinon.restore();
  });

  test('updates the active session pair projection from the quick pick selection', async () => {
    const sessionService = new SessionService();
    const session = sessionService.createBrowserSession(createSession('change-projection', createRevisions(4)));
    sinon.stub(vscode.window, 'showQuickPick').resolves({
      pairProjectionMode: 'base'
    } as never);

    await createChangePairProjectionCommand(createContext(sessionService))();

    assert.deepStrictEqual(sessionService.getSession(session.id)?.pairProjection, { mode: 'base' });
  });

  test('reuses the current custom pair selection when reopening the custom picker', async () => {
    const sessionService = new SessionService();
    const session = sessionService.createBrowserSession(createSession('change-projection-custom', createRevisions(4), 'custom'));
    const showQuickPickStub = sinon.stub(vscode.window, 'showQuickPick');
    showQuickPickStub.onFirstCall().resolves({
      pairProjectionMode: 'custom'
    } as never);
    showQuickPickStub.onSecondCall().callsFake(async (...args: unknown[]) => {
      const typedItems = args[0] as Array<{ pairKey: string; picked?: boolean }>;
      assert.deepStrictEqual(
        typedItems.filter((item) => item.picked).map((item) => item.pairKey),
        ['0:2', '1:3']
      );
      return typedItems.filter((item) => item.picked) as never;
    });

    await createChangePairProjectionCommand(createContext(sessionService))();

    assert.deepStrictEqual(sessionService.getSession(session.id)?.pairProjection, {
      mode: 'custom',
      pairKeys: ['0:2', '1:3']
    });
  });

  test('can update an explicitly targeted session without relying on the active session', async () => {
    const sessionService = new SessionService();
    const firstSession = sessionService.createBrowserSession(createSession('change-projection-first', createRevisions(3), 'adjacent'));
    const secondSession = sessionService.createBrowserSession(createSession('change-projection-second', createRevisions(4), 'adjacent'));
    sinon.stub(vscode.window, 'showQuickPick').resolves({
      pairProjectionMode: 'base'
    } as never);

    await createChangePairProjectionCommand(createContext(sessionService))(firstSession.id);

    assert.deepStrictEqual(sessionService.getSession(firstSession.id)?.pairProjection, { mode: 'base' });
    assert.deepStrictEqual(sessionService.getSession(secondSession.id)?.pairProjection, { mode: 'adjacent' });
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

function createSession(
  sessionId: string,
  revisions: readonly RevisionRef[],
  pairProjectionMode: 'adjacent' | 'base' | 'all' | 'custom' = 'adjacent'
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
    rowCount: 2,
    rawSnapshots: revisions.map((revision, index) => ({
      snapshotUri: vscode.Uri.file(`c:/repo/.fukusa-shadow/revisions/${revision.id}/src/sample.ts`),
      rawUri: vscode.Uri.file(`c:/repo/.fukusa-shadow/revisions/${revision.id}/src/sample.ts`),
      revisionIndex: index,
      revisionId: revision.id,
      revisionLabel: revision.shortLabel,
      relativePath: 'src/sample.ts',
      lineMap: {
        rowToOriginalLine: new Map([[1, 1], [2, 2]]),
        originalLineToRow: new Map([[1, 1], [2, 2]])
      }
    })),
    globalRows: Array.from({ length: 2 }, (_, rowIndex) => ({
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
      changedRowNumbers: [1]
    })),
    pairProjection: pairProjectionMode === 'custom'
      ? { mode: 'custom', pairKeys: ['0:2', '1:3'] }
      : { mode: pairProjectionMode },
    surfaceMode: 'native'
  };
}

function createRevisions(count: number): RevisionRef[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `rev-${index}`,
    shortLabel: `r${index}`
  }));
}
