import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';

import { CommandContext } from '../../commands/commandContext';
import { createSwitchCompareSurfaceCommand } from '../../commands/switchCompareSurface';
import { SessionService } from '../../application/sessionService';
import { createRevisions, createSession } from '../helpers/sessionHelpers';

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
