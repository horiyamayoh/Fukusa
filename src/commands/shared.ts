import * as vscode from 'vscode';

import { ResolvedResource, RevisionRef } from '../adapters/common/types';
import { createSnapshotCacheKey, toRepoCacheId } from '../infrastructure/cache/cacheKeys';
import { CommandContext } from './commandContext';

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

export async function browseAndOpenRevisions(context: CommandContext, resource: ResolvedResource): Promise<void> {
  const revisions = await context.revisionPickerService.pickMultipleRevisions(resource, {
    minSelection: 2,
    placeHolder: 'Choose 2 or more revisions for an N-way compare session.'
  });
  if (!revisions) {
    return;
  }

  try {
    await openCompareSessionWithRevisions(context, resource, revisions);
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

  await openCompareSessionWithRevisions(context, resource, revisions);
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

export async function openSession(context: CommandContext, resource: ResolvedResource): Promise<void> {
  await browseAndOpenRevisions(context, resource);
}

async function openCompareSessionWithRevisions(
  context: CommandContext,
  resource: ResolvedResource,
  revisions: readonly RevisionRef[]
): Promise<void> {
  const session = await context.sessionBuilderService.createSession(resource, revisions);
  await context.nativeCompareSessionController.openSession(session);
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

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
