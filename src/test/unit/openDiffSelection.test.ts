import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';

import { NWayCompareSession, RepoContext, ResolvedResource, RevisionRef } from '../../adapters/common/types';
import { CommandContext } from '../../commands/commandContext';
import { openDiffSelection } from '../../commands/shared';

suite('Unit: openDiffSelection', () => {
  const repo: RepoContext = {
    kind: 'git',
    repoRoot: 'c:/repo',
    repoId: 'repo123'
  };
  const resource: ResolvedResource = {
    repo,
    relativePath: 'src/sample.ts',
    originalUri: vscode.Uri.file('c:/repo/src/sample.ts')
  };

  teardown(() => {
    sinon.restore();
  });

  test('opens a 2-revision compare session through the unified builder', async () => {
    const { context, createSessionStub, openSessionStub } = createContext([
      { id: 'a1', shortLabel: 'a1' },
      { id: 'b2', shortLabel: 'b2' }
    ]);

    await openDiffSelection(context, resource);

    assert.strictEqual(createSessionStub.callCount, 1);
    assert.strictEqual(createSessionStub.firstCall.args[1].length, 2);
    assert.deepStrictEqual(createSessionStub.firstCall.args[2], {
      pairProjection: { mode: 'adjacent' },
      surfaceMode: 'native'
    });
    assert.strictEqual(openSessionStub.callCount, 1);
  });

  test('opens a multi-revision compare session when three revisions are selected', async () => {
    sinon.stub(vscode.window, 'showQuickPick').resolves({
      pairProjectionMode: 'base'
    } as never);
    const { context, createSessionStub, openSessionStub } = createContext([
      { id: 'a1', shortLabel: 'a1' },
      { id: 'b2', shortLabel: 'b2' },
      { id: 'c3', shortLabel: 'c3' }
    ]);

    await openDiffSelection(context, resource);

    assert.strictEqual(createSessionStub.callCount, 1);
    assert.strictEqual(createSessionStub.firstCall.args[1].length, 3);
    assert.deepStrictEqual(createSessionStub.firstCall.args[2], {
      pairProjection: { mode: 'base' },
      surfaceMode: 'native'
    });
    assert.strictEqual(openSessionStub.callCount, 1);
  });

  test('opens a custom multi-revision compare session when explicit pairs are selected', async () => {
    const showQuickPickStub = sinon.stub(vscode.window, 'showQuickPick');
    showQuickPickStub.onFirstCall().resolves({
      pairProjectionMode: 'custom'
    } as never);
    showQuickPickStub.onSecondCall().resolves([
      { pairKey: '0:2' },
      { pairKey: '1:3' }
    ] as never);
    const { context, createSessionStub, openSessionStub } = createContext([
      { id: 'a1', shortLabel: 'a1' },
      { id: 'b2', shortLabel: 'b2' },
      { id: 'c3', shortLabel: 'c3' },
      { id: 'd4', shortLabel: 'd4' }
    ]);

    await openDiffSelection(context, resource);

    assert.strictEqual(createSessionStub.callCount, 1);
    assert.deepStrictEqual(createSessionStub.firstCall.args[2], {
      pairProjection: { mode: 'custom', pairKeys: ['0:2', '1:3'] },
      surfaceMode: 'native'
    });
    assert.strictEqual(openSessionStub.callCount, 1);
  });
});

function createContext(revisions: readonly RevisionRef[]): {
  readonly context: CommandContext;
  readonly createSessionStub: sinon.SinonStub;
  readonly openSessionStub: sinon.SinonStub;
} {
  const createSessionStub = sinon.stub().resolves({ id: 'session-1' } as NWayCompareSession);
  const openSessionStub = sinon.stub().resolves();

  return {
    context: {
      output: { info: sinon.stub() },
      repositoryService: {} as never,
      revisionPickerService: {
        pickMultipleRevisions: sinon.stub().resolves(revisions)
      } as never,
      uriFactory: {} as never,
      compatibilityService: {} as never,
      sessionBuilderService: {
        createSession: createSessionStub
      } as never,
      sessionService: {} as never,
      compareSessionController: {
        openSession: openSessionStub
      } as never,
      cacheService: {} as never,
      blameDecorationController: {} as never
    } as unknown as CommandContext,
    createSessionStub,
    openSessionStub
  };
}
