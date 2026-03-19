import * as vscode from 'vscode';

import {
  ComparePairOverlay,
  ComparePairProjection,
  CompareSurfaceMode,
  NWayCompareSession,
  RawSnapshot,
  ResolvedResource,
  RevisionRef,
  SessionRowProjectionState
} from '../adapters/common/types';
import { createPresetPairProjection } from '../application/comparePairing';
import { createSnapshotCacheKey, toRepoCacheId } from '../infrastructure/cache/cacheKeys';
import { CommandContext } from './commandContext';
import { pickPairProjection } from './pairProjectionPicker';

export async function resolveTargetResource(
  context: CommandContext,
  uri?: vscode.Uri
): Promise<ResolvedResource | undefined> {
  const targetUri = uri ?? vscode.window.activeTextEditor?.document.uri;
  if (!targetUri) {
    void vscode.window.showInformationMessage('Open a file first.');
    return undefined;
  }

  const resource = await context.repositoryService.resolveResource(targetUri);
  if (!resource) {
    void vscode.window.showWarningMessage('The selected file is not inside a supported Git or SVN working copy.');
    return undefined;
  }

  context.output.info(`Target resource: ${resource.originalUri.toString()}`);
  return resource;
}

export async function browseAndOpenRevisions(
  context: CommandContext,
  resource: ResolvedResource,
  requestedPairProjection?: ComparePairProjection,
  requestedSurfaceMode?: CompareSurfaceMode
): Promise<void> {
  const revisions = await context.revisionPickerService.pickMultipleRevisions(resource, {
    minSelection: 2,
    placeHolder: 'Choose 2 or more revisions for an N-way compare session.'
  });
  if (!revisions) {
    return;
  }

  const pairProjection = await resolvePairProjection(revisions, requestedPairProjection);
  if (!pairProjection) {
    return;
  }

  try {
    await openCompareSessionWithRevisions(context, resource, revisions, pairProjection, requestedSurfaceMode ?? 'native');
  } catch (error) {
    context.output.error('Failed to open N-way compare session.', error);
    void vscode.window.showErrorMessage(`Failed to open Fukusa compare: ${toErrorMessage(error)}`);
  }
}

export async function openDiffSelection(context: CommandContext, resource: ResolvedResource): Promise<void> {
  await browseAndOpenRevisions(context, resource);
}

export async function openPairDiff(context: CommandContext, resource: ResolvedResource): Promise<void> {
  const revisions = await context.revisionPickerService.pickMultipleRevisions(resource, {
    minSelection: 2,
    placeHolder: 'Choose exactly 2 revisions to compare.'
  });
  if (!revisions) {
    return;
  }

  if (revisions.length !== 2) {
    void vscode.window.showWarningMessage('Select exactly 2 revisions for pair diff.');
    return;
  }

  await openCompareSessionWithRevisions(context, resource, revisions, createPresetPairProjection('adjacent'), 'native');
}

export async function openSingleSnapshot(context: CommandContext, resource: ResolvedResource): Promise<void> {
  const revision = await context.revisionPickerService.pickSingleRevision(resource);
  if (!revision) {
    return;
  }

  const session = await context.sessionBuilderService.createSession(resource, [revision]);
  const snapshot = session.rawSnapshots[0];
  const textDocument = await vscode.workspace.openTextDocument(snapshot.rawUri);
  await vscode.window.showTextDocument(textDocument, { preview: false, viewColumn: vscode.ViewColumn.Active });
}

export async function openSession(
  context: CommandContext,
  resource: ResolvedResource,
  requestedPairProjection?: ComparePairProjection,
  requestedSurfaceMode?: CompareSurfaceMode
): Promise<void> {
  await browseAndOpenRevisions(context, resource, requestedPairProjection, requestedSurfaceMode);
}

async function openCompareSessionWithRevisions(
  context: CommandContext,
  resource: ResolvedResource,
  revisions: readonly RevisionRef[],
  pairProjection: ComparePairProjection,
  surfaceMode: CompareSurfaceMode
): Promise<void> {
  const session = await context.sessionBuilderService.createSession(resource, revisions, {
    pairProjection,
    surfaceMode
  });
  await context.compareSessionController.openSession(session);
}

export async function warmSnapshots(context: CommandContext, resource: ResolvedResource, count = 10): Promise<void> {
  const adapter = context.repositoryService.getAdapter(resource.repo.kind);
  const revisions = await context.revisionPickerService.getHistory(resource, count);
  await Promise.all(revisions.map(async (revision) => {
    await context.cacheService.getOrLoadBytes(
      createSnapshotCacheKey(resource.repo, resource.relativePath, revision.id),
      () => adapter.getSnapshot(resource.repo, resource.relativePath, revision.id)
    );
  }));
}

export function getRepoCacheId(resource: ResolvedResource): string {
  return toRepoCacheId(resource.repo);
}

export interface SessionTreeSessionTarget {
  readonly kind: 'session';
  readonly session: Pick<NWayCompareSession, 'id'>;
}
export interface SessionSnapshotTarget {
  readonly sessionId: string;
  readonly revisionIndex: number;
}
export interface SessionTreeSnapshotTarget {
  readonly kind: 'snapshot';
  readonly sessionId: string;
  readonly snapshot: Pick<RawSnapshot, 'revisionIndex'>;
}
export type SessionCommandTarget = string | Pick<NWayCompareSession, 'id'> | SessionTreeSessionTarget | undefined;
export type SessionSnapshotCommandTarget =
  | SessionCommandTarget
  | SessionSnapshotTarget
  | SessionTreeSnapshotTarget
  | undefined;

export function getSessionTargetOrNotify(
  context: CommandContext,
  target?: SessionCommandTarget
): NWayCompareSession | undefined {
  const targetSessionId = toTargetSessionId(target);
  if (targetSessionId) {
    const session = context.sessionService.getBrowserSession(targetSessionId);
    if (!session) {
      void vscode.window.showInformationMessage('The requested Fukusa session no longer exists.');
      return undefined;
    }

    return session;
  }

  const activeSession = context.sessionService.getActiveBrowserSession();
  if (!activeSession) {
    void vscode.window.showInformationMessage('No active Fukusa session.');
    return undefined;
  }

  return activeSession;
}

export function getActiveSessionOrNotify(context: CommandContext): NWayCompareSession | undefined {
  return getSessionTargetOrNotify(context);
}

export function getActiveSnapshotOrNotify(
  context: CommandContext,
  target?: SessionCommandTarget
): { readonly session: NWayCompareSession; readonly snapshot: RawSnapshot } | undefined {
  const session = getSessionTargetOrNotify(context, target);
  if (!session) {
    return undefined;
  }

  const snapshot = context.sessionService.getActiveSnapshot(session);
  if (!snapshot) {
    void vscode.window.showInformationMessage('No active revision in the current Fukusa session.');
    return undefined;
  }

  return { session, snapshot };
}

export function getSnapshotTargetOrNotify(
  context: CommandContext,
  target?: SessionSnapshotCommandTarget
): { readonly session: NWayCompareSession; readonly snapshot: RawSnapshot } | undefined {
  if (isSessionTreeSnapshotTarget(target)) {
    const session = getSessionTargetOrNotify(context, target.sessionId);
    if (!session) {
      return undefined;
    }

    const snapshot = session.rawSnapshots[target.snapshot.revisionIndex];
    if (!snapshot) {
      void vscode.window.showInformationMessage('The requested revision is no longer part of this Fukusa session.');
      return undefined;
    }

    return { session, snapshot };
  }

  if (isSessionSnapshotTarget(target)) {
    const session = getSessionTargetOrNotify(context, target.sessionId);
    if (!session) {
      return undefined;
    }

    const snapshot = session.rawSnapshots[target.revisionIndex];
    if (!snapshot) {
      void vscode.window.showInformationMessage('The requested revision is no longer part of this Fukusa session.');
      return undefined;
    }

    return { session, snapshot };
  }

  return getActiveSnapshotOrNotify(context, target);
}

export function getActivePairOrNotify(
  context: CommandContext,
  target?: SessionCommandTarget
): { readonly session: NWayCompareSession; readonly pair: ComparePairOverlay } | undefined {
  const session = getSessionTargetOrNotify(context, target);
  if (!session) {
    return undefined;
  }

  const pair = context.sessionService.getActivePair(session);
  if (!pair) {
    void vscode.window.showInformationMessage('No active comparison pair.');
    return undefined;
  }

  return { session, pair };
}

export function getCollapseProjectionOrNotify(
  context: CommandContext,
  target?: SessionCommandTarget
): { readonly session: NWayCompareSession; readonly rowProjectionState: SessionRowProjectionState } | undefined {
  const session = getSessionTargetOrNotify(context, target);
  if (!session) {
    return undefined;
  }

  const rowProjectionState = context.sessionService.getRowProjectionState(session.id);
  if (!rowProjectionState.collapseUnchanged) {
    void vscode.window.showInformationMessage('Collapse Unchanged is not active for the current Fukusa session.');
    return undefined;
  }

  return { session, rowProjectionState };
}

export {
  canChangePairProjection,
  canShiftVisibleWindow,
  canShiftVisibleWindowLeft,
  canShiftVisibleWindowRight
} from '../application/sessionCapabilities';

function toTargetSessionId(target?: SessionCommandTarget): string | undefined {
  if (typeof target === 'string') {
    return target;
  }

  if (isSessionTreeSessionTarget(target)) {
    return target.session.id;
  }

  if (target && typeof target.id === 'string') {
    return target.id;
  }

  return undefined;
}

function isSessionSnapshotTarget(target?: SessionSnapshotCommandTarget): target is SessionSnapshotTarget {
  return Boolean(
    target
    && typeof target === 'object'
    && 'sessionId' in target
    && typeof target.sessionId === 'string'
    && 'revisionIndex' in target
    && typeof target.revisionIndex === 'number'
  );
}

function isSessionTreeSessionTarget(target?: SessionCommandTarget): target is SessionTreeSessionTarget {
  const sessionTarget = target as SessionTreeSessionTarget | undefined;
  return Boolean(
    sessionTarget
    && typeof sessionTarget === 'object'
    && sessionTarget.kind === 'session'
    && sessionTarget.session
    && typeof sessionTarget.session.id === 'string'
  );
}

function isSessionTreeSnapshotTarget(target?: SessionSnapshotCommandTarget): target is SessionTreeSnapshotTarget {
  const snapshotTarget = target as SessionTreeSnapshotTarget | undefined;
  return Boolean(
    snapshotTarget
    && typeof snapshotTarget === 'object'
    && snapshotTarget.kind === 'snapshot'
    && typeof snapshotTarget.sessionId === 'string'
    && snapshotTarget.snapshot
    && typeof snapshotTarget.snapshot.revisionIndex === 'number'
  );
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function resolvePairProjection(
  revisions: readonly RevisionRef[],
  requestedPairProjection?: ComparePairProjection
): Promise<ComparePairProjection | undefined> {
  return pickPairProjection(revisions, { requestedPairProjection });
}
