import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';

import { SessionService } from '../../application/sessionService';
import { CommandContext } from '../../commands/commandContext';
import { createResetExpandedGapsCommand } from '../../commands/resetExpandedGaps';
import { createRevisions, createSession } from '../helpers/sessionHelpers';

suite('Unit: resetExpandedGaps', () => {
  teardown(() => {
    sinon.restore();
  });

  test('resets the expanded gap set for the active session', () => {
    const sessionService = new SessionService();
    const session = sessionService.createBrowserSession(createSession('reset-gaps', createRevisions(3)));
    sessionService.toggleCollapseUnchanged(session.id);
    const resetExpandedGapsStub = sinon.stub().returns(true);

    createResetExpandedGapsCommand(createContext(sessionService, resetExpandedGapsStub))();

    assert.strictEqual(resetExpandedGapsStub.callCount, 1);
  });

  test('shows a message when collapse mode is not active', () => {
    const sessionService = new SessionService();
    sessionService.createBrowserSession(createSession('reset-gaps-disabled', createRevisions(3)));
    const showInformationMessageStub = sinon.stub(vscode.window, 'showInformationMessage');

    createResetExpandedGapsCommand(createContext(sessionService, sinon.stub().returns(false)))();

    assert.strictEqual(showInformationMessageStub.callCount, 1);
    assert.match(String(showInformationMessageStub.firstCall.args[0]), /Collapse Unchanged is not active/);
  });

  test('can reset a targeted session without relying on the active session', () => {
    const sessionService = new SessionService();
    const firstSession = sessionService.createBrowserSession(createSession('reset-gaps-target-first', createRevisions(3)));
    sessionService.createBrowserSession(createSession('reset-gaps-target-second', createRevisions(3)));
    sessionService.toggleCollapseUnchanged(firstSession.id);
    const resetExpandedGapsStub = sinon.stub().returns(true);

    createResetExpandedGapsCommand(createContext(sessionService, resetExpandedGapsStub))(firstSession.id);

    assert.strictEqual(resetExpandedGapsStub.callCount, 1);
    assert.deepStrictEqual(resetExpandedGapsStub.firstCall.args, [firstSession.id]);
  });
});

function createContext(
  sessionService: SessionService,
  resetExpandedGapsStub: sinon.SinonStub
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
      resetSessionExpandedGaps: resetExpandedGapsStub
    } as never,
    cacheService: {} as never,
    blameDecorationController: {} as never
  } as unknown as CommandContext;
}
