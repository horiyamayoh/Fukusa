import * as vscode from 'vscode';

import { CompareSurfaceMode, NWayCompareSession } from '../../adapters/common/types';
import { SessionService } from '../../application/sessionService';
import { NativeCompareSessionController } from '../native/nativeCompareSessionController';
import { PanelCompareSessionController } from './panelCompareSessionController';

export class CompareSurfaceCoordinator implements vscode.Disposable {
  public constructor(
    private readonly sessionService: SessionService,
    private readonly nativeController: NativeCompareSessionController,
    private readonly panelController: PanelCompareSessionController
  ) {}

  public async openSession(session: NWayCompareSession): Promise<void> {
    if (session.surfaceMode === 'panel') {
      await this.panelController.openSession(session);
      return;
    }

    await this.nativeController.openSession(session);
  }

  public async revealSession(sessionId: string): Promise<void> {
    const session = this.sessionService.getBrowserSession(sessionId);
    if (!session) {
      return;
    }

    if (session.surfaceMode === 'panel') {
      await this.panelController.revealSession(sessionId);
      return;
    }

    await this.nativeController.revealSession(sessionId);
  }

  public async closeActiveSession(): Promise<void> {
    const session = this.sessionService.getActiveBrowserSession();
    if (!session) {
      return;
    }

    await this.closeSession(session.id);
  }

  public async switchActiveSurface(surfaceMode: CompareSurfaceMode): Promise<boolean> {
    const session = this.sessionService.getActiveBrowserSession();
    if (!session) {
      return false;
    }

    return this.switchSessionSurface(session.id, surfaceMode);
  }

  public async closeSession(sessionId: string): Promise<boolean> {
    const session = this.sessionService.getBrowserSession(sessionId);
    if (!session) {
      return false;
    }

    const closed = session.surfaceMode === 'panel'
      ? await this.panelController.closeSessionSurface(session.id)
      : await this.nativeController.closeSessionSurface(session.id);
    if (!closed) {
      return false;
    }

    this.sessionService.removeSession(session.id);
    return true;
  }

  public async switchSessionSurface(sessionId: string, surfaceMode: CompareSurfaceMode): Promise<boolean> {
    const session = this.sessionService.getBrowserSession(sessionId);
    if (!session) {
      return false;
    }

    if (session.surfaceMode === surfaceMode) {
      return true;
    }

    const closed = session.surfaceMode === 'panel'
      ? await this.panelController.closeSessionSurface(session.id)
      : await this.nativeController.closeSessionSurface(session.id);
    if (!closed) {
      return false;
    }

    const updatedSession = this.sessionService.updateSurfaceMode(session.id, surfaceMode);
    if (!updatedSession) {
      return false;
    }

    await this.openSession(updatedSession);
    return true;
  }

  public async shiftWindow(delta: number): Promise<void> {
    const session = this.sessionService.getActiveBrowserSession();
    if (!session || session.surfaceMode === 'panel') {
      return;
    }

    await this.shiftSessionWindow(session.id, delta);
  }

  public async shiftSessionWindow(sessionId: string, delta: number): Promise<boolean> {
    const session = this.sessionService.getBrowserSession(sessionId);
    if (!session || session.surfaceMode === 'panel') {
      return false;
    }

    return this.nativeController.shiftSessionWindow(session.id, delta);
  }

  public toggleCollapseUnchanged(): boolean {
    const session = this.sessionService.getActiveBrowserSession();
    if (!session) {
      return false;
    }

    return this.toggleSessionCollapseUnchanged(session.id);
  }

  public expandAllCollapsedGaps(): boolean {
    const session = this.sessionService.getActiveBrowserSession();
    if (!session) {
      return false;
    }

    return this.expandAllSessionCollapsedGaps(session.id);
  }

  public resetExpandedGaps(): boolean {
    const session = this.sessionService.getActiveBrowserSession();
    if (!session) {
      return false;
    }

    return this.resetSessionExpandedGaps(session.id);
  }

  public toggleSessionCollapseUnchanged(sessionId: string): boolean {
    const session = this.sessionService.getBrowserSession(sessionId);
    if (!session) {
      return false;
    }

    this.sessionService.toggleCollapseUnchanged(session.id);
    return true;
  }

  public expandAllSessionCollapsedGaps(sessionId: string): boolean {
    const session = this.sessionService.getBrowserSession(sessionId);
    if (!session) {
      return false;
    }

    const before = this.sessionService.getRowProjectionState(session.id).expandedGapKeys.length;
    const next = this.sessionService.expandAllProjectionGaps(session.id);
    return (next?.expandedGapKeys.length ?? before) > before;
  }

  public resetSessionExpandedGaps(sessionId: string): boolean {
    const session = this.sessionService.getBrowserSession(sessionId);
    if (!session) {
      return false;
    }

    const before = this.sessionService.getRowProjectionState(session.id).expandedGapKeys.length;
    const next = this.sessionService.resetExpandedProjectionGaps(session.id);
    return before > 0 && (next?.expandedGapKeys.length ?? before) === 0;
  }

  public dispose(): void {
    // Owned by the extension's top-level disposables.
  }
}
