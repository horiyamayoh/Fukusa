import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';

import { CommandContext } from '../../commands/commandContext';
import { createChangePairProjectionCommand } from '../../commands/changePairProjection';
import { SessionService } from '../../application/sessionService';
import { createRevisions, createSession } from '../helpers/sessionHelpers';

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
    const session = sessionService.createBrowserSession(createSession('change-projection-custom', createRevisions(4), {
      pairProjection: { mode: 'custom', pairKeys: ['0:2', '1:3'] }
    }));
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
    const firstSession = sessionService.createBrowserSession(createSession('change-projection-first', createRevisions(3)));
    const secondSession = sessionService.createBrowserSession(createSession('change-projection-second', createRevisions(4)));
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
