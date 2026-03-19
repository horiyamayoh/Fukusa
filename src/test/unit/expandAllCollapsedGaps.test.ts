import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';

import { NWayCompareSession, RepoContext, RevisionRef } from '../../adapters/common/types';
import { RepositoryRegistry } from '../../application/repositoryRegistry';
import { SessionService } from '../../application/sessionService';
import { CommandContext } from '../../commands/commandContext';
import { createExpandAllCollapsedGapsCommand } from '../../commands/expandAllCollapsedGaps';
import { UriFactory } from '../../infrastructure/fs/uriFactory';

suite('Unit: expandAllCollapsedGaps', () => {
  teardown(() => {
    sinon.restore();
  });

  test('expands every collapsed gap for the active session', () => {
    const sessionService = new SessionService();
    const session = sessionService.createBrowserSession(createSession('expand-gaps', createRevisions(3)));
    sessionService.toggleCollapseUnchanged(session.id);
    const expandAllCollapsedGapsStub = sinon.stub().returns(true);

    createExpandAllCollapsedGapsCommand(createContext(sessionService, expandAllCollapsedGapsStub))();

    assert.strictEqual(expandAllCollapsedGapsStub.callCount, 1);
  });

  test('shows a message when collapse mode is not active', () => {
    const sessionService = new SessionService();
    sessionService.createBrowserSession(createSession('expand-gaps-disabled', createRevisions(3)));
    const showInformationMessageStub = sinon.stub(vscode.window, 'showInformationMessage');

    createExpandAllCollapsedGapsCommand(createContext(sessionService, sinon.stub().returns(false)))();

    assert.strictEqual(showInformationMessageStub.callCount, 1);
    assert.match(String(showInformationMessageStub.firstCall.args[0]), /Collapse Unchanged is not active/);
  });

  test('can expand a targeted session without relying on the active session', () => {
    const sessionService = new SessionService();
    const firstSession = sessionService.createBrowserSession(createSession('expand-gaps-target-first', createRevisions(3)));
    sessionService.createBrowserSession(createSession('expand-gaps-target-second', createRevisions(3)));
    sessionService.toggleCollapseUnchanged(firstSession.id);
    const expandAllCollapsedGapsStub = sinon.stub().returns(true);

    createExpandAllCollapsedGapsCommand(createContext(sessionService, expandAllCollapsedGapsStub))(firstSession.id);

    assert.strictEqual(expandAllCollapsedGapsStub.callCount, 1);
    assert.deepStrictEqual(expandAllCollapsedGapsStub.firstCall.args, [firstSession.id]);
  });
});

function createContext(
  sessionService: SessionService,
  expandAllCollapsedGapsStub: sinon.SinonStub
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
      expandAllSessionCollapsedGaps: expandAllCollapsedGapsStub
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
