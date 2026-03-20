import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';

import { SessionService } from '../../application/sessionService';
import { CommandContext } from '../../commands/commandContext';
import { createShiftWindowLeftCommand } from '../../commands/shiftWindowLeft';
import { createShiftWindowRightCommand } from '../../commands/shiftWindowRight';
import { createRevisions, createSession } from '../helpers/sessionHelpers';

suite('Unit: shiftWindow commands', () => {
  teardown(() => {
    sinon.restore();
  });

  test('shifts left for an explicitly targeted session', async () => {
    const sessionService = new SessionService();
    const firstSession = sessionService.createBrowserSession(createSession('shift-left-first', createRevisions(11)));
    sessionService.createBrowserSession(createSession('shift-left-second', createRevisions(3)));
    sessionService.shiftWindow(firstSession.id, 1);
    const shiftSessionWindowStub = sinon.stub().resolves(true);

    await createShiftWindowLeftCommand(createContext(sessionService, shiftSessionWindowStub))(firstSession.id);

    assert.strictEqual(shiftSessionWindowStub.callCount, 1);
    assert.deepStrictEqual(shiftSessionWindowStub.firstCall.args, [firstSession.id, -1]);
  });

  test('shows a message when shifting left at the first page', async () => {
    const sessionService = new SessionService();
    const session = sessionService.createBrowserSession(createSession('shift-left-boundary', createRevisions(11)));
    const shiftSessionWindowStub = sinon.stub().resolves(true);
    const showInformationMessageStub = sinon.stub(vscode.window, 'showInformationMessage');

    await createShiftWindowLeftCommand(createContext(sessionService, shiftSessionWindowStub))(session.id);

    assert.strictEqual(shiftSessionWindowStub.callCount, 0);
    assert.match(String(showInformationMessageStub.firstCall.args[0]), /first visible revision window/);
  });

  test('shifts right for an explicitly targeted session', async () => {
    const sessionService = new SessionService();
    const firstSession = sessionService.createBrowserSession(createSession('shift-right-first', createRevisions(11)));
    sessionService.createBrowserSession(createSession('shift-right-second', createRevisions(3)));
    const shiftSessionWindowStub = sinon.stub().resolves(true);

    await createShiftWindowRightCommand(createContext(sessionService, shiftSessionWindowStub))(firstSession.id);

    assert.strictEqual(shiftSessionWindowStub.callCount, 1);
    assert.deepStrictEqual(shiftSessionWindowStub.firstCall.args, [firstSession.id, 1]);
  });

  test('shows a message when shifting right at the last page', async () => {
    const sessionService = new SessionService();
    const session = sessionService.createBrowserSession(createSession('shift-right-boundary', createRevisions(11)));
    sessionService.shiftWindow(session.id, 2);
    const shiftSessionWindowStub = sinon.stub().resolves(true);
    const showInformationMessageStub = sinon.stub(vscode.window, 'showInformationMessage');

    await createShiftWindowRightCommand(createContext(sessionService, shiftSessionWindowStub))(session.id);

    assert.strictEqual(shiftSessionWindowStub.callCount, 0);
    assert.match(String(showInformationMessageStub.firstCall.args[0]), /last visible revision window/);
  });
});

function createContext(
  sessionService: SessionService,
  shiftSessionWindowStub: sinon.SinonStub
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
      shiftSessionWindow: shiftSessionWindowStub
    } as never,
    cacheService: {} as never,
    blameDecorationController: {} as never
  } as unknown as CommandContext;
}
