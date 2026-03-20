import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';

import { NWayCompareSession } from '../../adapters/common/types';
import { SessionService } from '../../application/sessionService';
import { CompareSurfaceCoordinator } from '../../presentation/compare/compareSurfaceCoordinator';
import { createRevisions, createSession } from '../helpers/sessionHelpers';

suite('Unit: CompareSurfaceCoordinator', () => {
  teardown(() => {
    sinon.restore();
  });

  test('switches the active session from panel to native without deleting the session', async () => {
    const sessionService = new SessionService();
    const session = sessionService.createBrowserSession(createSession('surface-switch', createRevisions(3), {
      surfaceMode: 'panel'
    }));
    const nativeOpenSession = sinon.stub().resolves();
    const panelCloseSurface = sinon.stub().resolves(true);
    const nativeController = {
      openSession: nativeOpenSession,
      closeSessionSurface: sinon.stub().resolves(true),
      closeActiveSession: sinon.stub().resolves(),
      shiftWindow: sinon.stub().resolves()
    } as unknown as ConstructorParameters<typeof CompareSurfaceCoordinator>[1];
    const panelController = {
      openSession: sinon.stub().resolves(),
      closeSessionSurface: panelCloseSurface,
      closeActiveSession: sinon.stub().resolves()
    } as unknown as ConstructorParameters<typeof CompareSurfaceCoordinator>[2];
    const coordinator = new CompareSurfaceCoordinator(sessionService, nativeController, panelController);

    const switched = await coordinator.switchActiveSurface('native');

    assert.strictEqual(switched, true);
    assert.strictEqual(panelCloseSurface.callCount, 1);
    assert.strictEqual(nativeOpenSession.callCount, 1);
    assert.strictEqual(sessionService.getSession(session.id)?.surfaceMode, 'native');
  });

  test('does not switch surfaces when the current surface fails to close', async () => {
    const sessionService = new SessionService();
    const session = sessionService.createBrowserSession(createSession('surface-switch-fail', createRevisions(3)));
    const nativeCloseSurface = sinon.stub().resolves(false);
    const panelOpenSession = sinon.stub().resolves();
    const nativeController = {
      openSession: sinon.stub().resolves(),
      closeSessionSurface: nativeCloseSurface,
      closeActiveSession: sinon.stub().resolves(),
      shiftWindow: sinon.stub().resolves()
    } as unknown as ConstructorParameters<typeof CompareSurfaceCoordinator>[1];
    const panelController = {
      openSession: panelOpenSession,
      closeSessionSurface: sinon.stub().resolves(true),
      closeActiveSession: sinon.stub().resolves()
    } as unknown as ConstructorParameters<typeof CompareSurfaceCoordinator>[2];
    const coordinator = new CompareSurfaceCoordinator(sessionService, nativeController, panelController);

    const switched = await coordinator.switchActiveSurface('panel');

    assert.strictEqual(switched, false);
    assert.strictEqual(nativeCloseSurface.callCount, 1);
    assert.strictEqual(panelOpenSession.callCount, 0);
    assert.strictEqual(sessionService.getSession(session.id)?.surfaceMode, 'native');
  });

  test('restores the previous surface when opening the target surface fails', async () => {
    const sessionService = new SessionService();
    const session = sessionService.createBrowserSession(createSession('surface-switch-open-fail', createRevisions(3)));
    const nativeOpenSession = sinon.stub().resolves();
    const nativeCloseSurface = sinon.stub().resolves(true);
    const panelOpenSession = sinon.stub().rejects(new Error('panel unavailable'));
    const nativeController = {
      openSession: nativeOpenSession,
      revealSession: sinon.stub().resolves(),
      closeSessionSurface: nativeCloseSurface,
      closeActiveSession: sinon.stub().resolves(),
      shiftWindow: sinon.stub().resolves()
    } as unknown as ConstructorParameters<typeof CompareSurfaceCoordinator>[1];
    const panelController = {
      openSession: panelOpenSession,
      revealSession: sinon.stub().resolves(),
      closeSessionSurface: sinon.stub().resolves(true),
      closeActiveSession: sinon.stub().resolves()
    } as unknown as ConstructorParameters<typeof CompareSurfaceCoordinator>[2];
    const coordinator = new CompareSurfaceCoordinator(sessionService, nativeController, panelController);

    const switched = await coordinator.switchSessionSurface(session.id, 'panel');

    assert.strictEqual(switched, false);
    assert.strictEqual(nativeCloseSurface.callCount, 1);
    assert.strictEqual(panelOpenSession.callCount, 1);
    assert.strictEqual(nativeOpenSession.callCount, 1);
    assert.strictEqual((nativeOpenSession.firstCall.args[0] as NWayCompareSession).surfaceMode, 'native');
    assert.strictEqual(sessionService.getSession(session.id)?.surfaceMode, 'native');
  });

  test('can close a non-active target session without going through the active-session path', async () => {
    const sessionService = new SessionService();
    const firstSession = sessionService.createBrowserSession(createSession('surface-close-first', createRevisions(3)));
    const secondSession = sessionService.createBrowserSession(createSession('surface-close-second', createRevisions(3), {
      surfaceMode: 'panel'
    }));
    const nativeController = {
      openSession: sinon.stub().resolves(),
      revealSession: sinon.stub().resolves(),
      closeSessionSurface: sinon.stub().resolves(true),
      closeActiveSession: sinon.stub().resolves(),
      shiftWindow: sinon.stub().resolves()
    } as unknown as ConstructorParameters<typeof CompareSurfaceCoordinator>[1];
    const panelCloseSurface = sinon.stub().resolves(true);
    const panelController = {
      openSession: sinon.stub().resolves(),
      revealSession: sinon.stub().resolves(),
      closeSessionSurface: panelCloseSurface,
      closeActiveSession: sinon.stub().resolves()
    } as unknown as ConstructorParameters<typeof CompareSurfaceCoordinator>[2];
    const coordinator = new CompareSurfaceCoordinator(sessionService, nativeController, panelController);

    const closed = await coordinator.closeSession(firstSession.id);

    assert.strictEqual(closed, true);
    assert.strictEqual(sessionService.getSession(firstSession.id), undefined);
    assert.ok(sessionService.getSession(secondSession.id));
    assert.strictEqual(panelCloseSurface.callCount, 0);
  });

  test('switches the requested target session surface without relying on the active session', async () => {
    const sessionService = new SessionService();
    const firstSession = sessionService.createBrowserSession(createSession('surface-switch-first', createRevisions(3)));
    const secondSession = sessionService.createBrowserSession(createSession('surface-switch-second', createRevisions(3), {
      surfaceMode: 'panel'
    }));
    const nativeOpenSession = sinon.stub().resolves();
    const panelCloseSurface = sinon.stub().resolves(true);
    const nativeController = {
      openSession: nativeOpenSession,
      revealSession: sinon.stub().resolves(),
      closeSessionSurface: sinon.stub().resolves(true),
      closeActiveSession: sinon.stub().resolves(),
      shiftWindow: sinon.stub().resolves()
    } as unknown as ConstructorParameters<typeof CompareSurfaceCoordinator>[1];
    const panelController = {
      openSession: sinon.stub().resolves(),
      revealSession: sinon.stub().resolves(),
      closeSessionSurface: panelCloseSurface,
      closeActiveSession: sinon.stub().resolves()
    } as unknown as ConstructorParameters<typeof CompareSurfaceCoordinator>[2];
    const coordinator = new CompareSurfaceCoordinator(sessionService, nativeController, panelController);

    const switched = await coordinator.switchSessionSurface(firstSession.id, 'panel');

    assert.strictEqual(switched, true);
    assert.strictEqual(sessionService.getSession(firstSession.id)?.surfaceMode, 'panel');
    assert.strictEqual(sessionService.getSession(secondSession.id)?.surfaceMode, 'panel');
    assert.strictEqual(panelCloseSurface.callCount, 0);
    assert.strictEqual(nativeOpenSession.callCount, 0);
  });

  test('expands all collapsed gaps for the active session', () => {
    const sessionService = new SessionService();
    const session = sessionService.createBrowserSession(createSession('surface-expand-gaps', createRevisions(3), {
      rowCount: 20,
      changedRowNumbers: [10]
    }));
    sessionService.toggleCollapseUnchanged(session.id);
    const coordinator = new CompareSurfaceCoordinator(
      sessionService,
      {
        openSession: sinon.stub().resolves(),
        closeSessionSurface: sinon.stub().resolves(true),
        closeActiveSession: sinon.stub().resolves(),
        shiftWindow: sinon.stub().resolves()
      } as unknown as ConstructorParameters<typeof CompareSurfaceCoordinator>[1],
      {
        openSession: sinon.stub().resolves(),
        closeSessionSurface: sinon.stub().resolves(true),
        closeActiveSession: sinon.stub().resolves()
      } as unknown as ConstructorParameters<typeof CompareSurfaceCoordinator>[2]
    );

    const expanded = coordinator.expandAllCollapsedGaps();

    assert.strictEqual(expanded, true);
    assert.deepStrictEqual(sessionService.getRowProjectionState(session.id), {
      collapseUnchanged: true,
      expandedGapKeys: ['1:6', '14:20']
    });
  });

  test('resets expanded gaps for the active session', () => {
    const sessionService = new SessionService();
    const session = sessionService.createBrowserSession(createSession('surface-reset-gaps', createRevisions(3), {
      rowCount: 20,
      changedRowNumbers: [10]
    }));
    sessionService.toggleCollapseUnchanged(session.id);
    sessionService.expandProjectionGap(session.id, '14:20');
    const coordinator = new CompareSurfaceCoordinator(
      sessionService,
      {
        openSession: sinon.stub().resolves(),
        closeSessionSurface: sinon.stub().resolves(true),
        closeActiveSession: sinon.stub().resolves(),
        shiftWindow: sinon.stub().resolves()
      } as unknown as ConstructorParameters<typeof CompareSurfaceCoordinator>[1],
      {
        openSession: sinon.stub().resolves(),
        closeSessionSurface: sinon.stub().resolves(true),
        closeActiveSession: sinon.stub().resolves()
      } as unknown as ConstructorParameters<typeof CompareSurfaceCoordinator>[2]
    );

    const reset = coordinator.resetExpandedGaps();

    assert.strictEqual(reset, true);
    assert.deepStrictEqual(sessionService.getRowProjectionState(session.id), {
      collapseUnchanged: true,
      expandedGapKeys: []
    });
  });

  test('toggles collapse projection for a targeted session', () => {
    const sessionService = new SessionService();
    const firstSession = sessionService.createBrowserSession(createSession('surface-toggle-first', createRevisions(3), {
      rowCount: 20,
      changedRowNumbers: [10]
    }));
    sessionService.createBrowserSession(createSession('surface-toggle-second', createRevisions(3), {
      rowCount: 20,
      changedRowNumbers: [10]
    }));
    const coordinator = new CompareSurfaceCoordinator(
      sessionService,
      {
        openSession: sinon.stub().resolves(),
        revealSession: sinon.stub().resolves(),
        closeSessionSurface: sinon.stub().resolves(true),
        closeActiveSession: sinon.stub().resolves(),
        shiftWindow: sinon.stub().resolves()
      } as unknown as ConstructorParameters<typeof CompareSurfaceCoordinator>[1],
      {
        openSession: sinon.stub().resolves(),
        revealSession: sinon.stub().resolves(),
        closeSessionSurface: sinon.stub().resolves(true),
        closeActiveSession: sinon.stub().resolves()
      } as unknown as ConstructorParameters<typeof CompareSurfaceCoordinator>[2]
    );

    const toggled = coordinator.toggleSessionCollapseUnchanged(firstSession.id);

    assert.strictEqual(toggled, true);
    assert.deepStrictEqual(sessionService.getRowProjectionState(firstSession.id), {
      collapseUnchanged: true,
      expandedGapKeys: []
    });
  });

  test('shifts the requested target native session window without relying on the active session', async () => {
    const sessionService = new SessionService();
    const firstSession = sessionService.createBrowserSession(createSession('surface-shift-first', createRevisions(11)));
    sessionService.createBrowserSession(createSession('surface-shift-second', createRevisions(3), {
      surfaceMode: 'panel'
    }));
    const shiftSessionWindowStub = sinon.stub().resolves(true);
    const coordinator = new CompareSurfaceCoordinator(
      sessionService,
      {
        openSession: sinon.stub().resolves(),
        revealSession: sinon.stub().resolves(),
        closeSessionSurface: sinon.stub().resolves(true),
        closeActiveSession: sinon.stub().resolves(),
        shiftWindow: sinon.stub().resolves(),
        shiftSessionWindow: shiftSessionWindowStub
      } as unknown as ConstructorParameters<typeof CompareSurfaceCoordinator>[1],
      {
        openSession: sinon.stub().resolves(),
        revealSession: sinon.stub().resolves(),
        closeSessionSurface: sinon.stub().resolves(true),
        closeActiveSession: sinon.stub().resolves()
      } as unknown as ConstructorParameters<typeof CompareSurfaceCoordinator>[2]
    );

    const shifted = await coordinator.shiftSessionWindow(firstSession.id, 1);

    assert.strictEqual(shifted, true);
    assert.deepStrictEqual(shiftSessionWindowStub.firstCall.args, [firstSession.id, 1]);
  });

  test('routes aligned editor scrolling through the native controller', async () => {
    const sessionService = new SessionService();
    sessionService.createBrowserSession(createSession('surface-scroll-aligned', createRevisions(3)));
    const scrollActiveEditorAlignedStub = sinon.stub().resolves(true);
    const coordinator = new CompareSurfaceCoordinator(
      sessionService,
      {
        openSession: sinon.stub().resolves(),
        revealSession: sinon.stub().resolves(),
        closeSessionSurface: sinon.stub().resolves(true),
        closeActiveSession: sinon.stub().resolves(),
        shiftWindow: sinon.stub().resolves(),
        shiftSessionWindow: sinon.stub().resolves(true),
        scrollActiveEditorAligned: scrollActiveEditorAlignedStub
      } as unknown as ConstructorParameters<typeof CompareSurfaceCoordinator>[1],
      {
        openSession: sinon.stub().resolves(),
        revealSession: sinon.stub().resolves(),
        closeSessionSurface: sinon.stub().resolves(true),
        closeActiveSession: sinon.stub().resolves()
      } as unknown as ConstructorParameters<typeof CompareSurfaceCoordinator>[2]
    );

    const scrolled = await coordinator.scrollActiveEditorAligned(1);

    assert.strictEqual(scrolled, true);
    assert.deepStrictEqual(scrollActiveEditorAlignedStub.firstCall.args, [1]);
  });
});
