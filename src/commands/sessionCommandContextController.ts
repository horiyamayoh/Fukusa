import * as vscode from 'vscode';

import { getSessionCapabilityState } from '../application/sessionCapabilities';
import { SessionService } from '../application/sessionService';

interface CommandCapabilityState {
  readonly hasActiveSession: boolean;
  readonly activeSurfaceIsNative: boolean;
  readonly activeSurfaceIsPanel: boolean;
  readonly canChangePairProjection: boolean;
  readonly canShiftWindow: boolean;
  readonly canShiftWindowLeft: boolean;
  readonly canShiftWindowRight: boolean;
  readonly hasActiveSnapshot: boolean;
  readonly hasActivePair: boolean;
  readonly collapseUnchangedActive: boolean;
  readonly hasCollapsedGaps: boolean;
  readonly hasExpandedGaps: boolean;
}

const COMMAND_CONTEXT_KEYS: Readonly<Record<keyof CommandCapabilityState, string>> = {
  hasActiveSession: 'multidiff.hasActiveSession',
  activeSurfaceIsNative: 'multidiff.activeSurfaceIsNative',
  activeSurfaceIsPanel: 'multidiff.activeSurfaceIsPanel',
  canChangePairProjection: 'multidiff.canChangePairProjection',
  canShiftWindow: 'multidiff.canShiftWindow',
  canShiftWindowLeft: 'multidiff.canShiftWindowLeft',
  canShiftWindowRight: 'multidiff.canShiftWindowRight',
  hasActiveSnapshot: 'multidiff.hasActiveSnapshot',
  hasActivePair: 'multidiff.hasActivePair',
  collapseUnchangedActive: 'multidiff.collapseUnchangedActive',
  hasCollapsedGaps: 'multidiff.hasCollapsedGaps',
  hasExpandedGaps: 'multidiff.hasExpandedGaps'
};

export class SessionCommandContextController implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private lastState?: CommandCapabilityState;

  public constructor(private readonly sessionService: SessionService) {
    this.disposables.push(
      this.sessionService.onDidChangeSessions(() => {
        void this.refresh();
      }),
      this.sessionService.onDidChangeSessionViewState(() => {
        void this.refresh();
      }),
      this.sessionService.onDidChangeSessionProjection(() => {
        void this.refresh();
      }),
      this.sessionService.onDidChangeSessionPresentation(() => {
        void this.refresh();
      })
    );

    void this.refresh();
  }

  public dispose(): void {
    while (this.disposables.length > 0) {
      this.disposables.pop()?.dispose();
    }
  }

  private async refresh(): Promise<void> {
    const nextState = this.buildState();
    const updates = (Object.keys(COMMAND_CONTEXT_KEYS) as Array<keyof CommandCapabilityState>)
      .filter((key) => this.lastState?.[key] !== nextState[key])
      .map((key) => vscode.commands.executeCommand('setContext', COMMAND_CONTEXT_KEYS[key], nextState[key]));

    this.lastState = nextState;
    await Promise.all(updates);
  }

  private buildState(): CommandCapabilityState {
    const session = this.sessionService.getActiveBrowserSession();
    if (!session) {
      return {
        hasActiveSession: false,
        activeSurfaceIsNative: false,
        activeSurfaceIsPanel: false,
        canChangePairProjection: false,
        canShiftWindow: false,
        canShiftWindowLeft: false,
        canShiftWindowRight: false,
        hasActiveSnapshot: false,
        hasActivePair: false,
        collapseUnchangedActive: false,
        hasCollapsedGaps: false,
        hasExpandedGaps: false
      };
    }

    const viewState = this.sessionService.getSessionViewState(session.id);
    const rowProjectionState = this.sessionService.getRowProjectionState(session.id);
    const capabilities = getSessionCapabilityState(session, viewState, rowProjectionState);

    return {
      hasActiveSession: true,
      activeSurfaceIsNative: session.surfaceMode === 'native',
      activeSurfaceIsPanel: session.surfaceMode === 'panel',
      canChangePairProjection: capabilities.canChangePairProjection,
      canShiftWindow: capabilities.canShiftWindow,
      canShiftWindowLeft: capabilities.canShiftWindowLeft,
      canShiftWindowRight: capabilities.canShiftWindowRight,
      hasActiveSnapshot: capabilities.hasActiveSnapshot,
      hasActivePair: capabilities.hasActivePair,
      collapseUnchangedActive: capabilities.collapseUnchanged,
      hasCollapsedGaps: capabilities.hasCollapsedGaps,
      hasExpandedGaps: capabilities.hasExpandedGaps
    };
  }
}
