import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';

import { SessionService } from '../../application/sessionService';
import { CommandContext } from '../../commands/commandContext';
import { createToggleCollapseUnchangedCommand } from '../../commands/toggleCollapseUnchanged';
import { createRevisions, createSession } from '../helpers/sessionHelpers';

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
