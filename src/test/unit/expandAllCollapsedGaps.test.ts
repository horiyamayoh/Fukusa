import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';

import { SessionService } from '../../application/sessionService';
import { CommandContext } from '../../commands/commandContext';
import { createExpandAllCollapsedGapsCommand } from '../../commands/expandAllCollapsedGaps';
import { createRevisions, createSession } from '../helpers/sessionHelpers';

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
