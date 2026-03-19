import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';

import { NWayCompareSession, RepoContext, RevisionRef } from '../../adapters/common/types';
import { RepositoryRegistry } from '../../application/repositoryRegistry';
import { SessionService } from '../../application/sessionService';
import { CommandContext } from '../../commands/commandContext';
import { createToggleCollapseUnchangedCommand } from '../../commands/toggleCollapseUnchanged';
import { UriFactory } from '../../infrastructure/fs/uriFactory';

suite('Unit: toggleCollapseUnchanged', () => {
  teardown(() => {
    sinon.restore();
  });

  test('toggles collapse for the active session', () => {
    const sessionService = new SessionService();
    const session = sessionService.createBrowserSession(createSession('toggle-collapse', createRevisions(3)));
    const toggleSessionCollapseUnchangedStub = sinon.stub().returns(true);

    createToggleCollapseUnchangedCommand(createContext(sessionService, toggleSessionCollapseUnchangedStub))();

    assert.strictEqual(toggleSessionCollapseUnchangedStub.callCount, 1);
    assert.deepStrictEqual(toggleSessionCollapseUnchangedStub.firstCall.args, [session.id]);
  });

  test('toggles collapse for an explicitly targeted session', () => {
    const sessionService = new SessionService();
    const firstSession = sessionService.createBrowserSession(createSession('toggle-collapse-first', createRevisions(3)));
    sessionService.createBrowserSession(createSession('toggle-collapse-second', createRevisions(3)));
    const toggleSessionCollapseUnchangedStub = sinon.stub().returns(true);

    createToggleCollapseUnchangedCommand(createContext(sessionService, toggleSessionCollapseUnchangedStub))(firstSession.id);

    assert.strictEqual(toggleSessionCollapseUnchangedStub.callCount, 1);
    assert.deepStrictEqual(toggleSessionCollapseUnchangedStub.firstCall.args, [firstSession.id]);
  });
});

function createContext(
  sessionService: SessionService,
  toggleSessionCollapseUnchangedStub: sinon.SinonStub
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
      toggleSessionCollapseUnchanged: toggleSessionCollapseUnchangedStub
    } as never,
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
    rowCount: 20,
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
    globalRows: Array.from({ length: 20 }, (_, rowIndex) => ({
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
      changedRowNumbers: [10]
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
