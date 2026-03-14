import * as vscode from 'vscode';

import { ResolvedResource, SessionMode } from '../adapters/common/types';
import { toRepoCacheId, createSnapshotCacheKey } from '../infrastructure/cache/cacheKeys';
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

  const leftUri = await context.compatibilityService.resolveSnapshotUri(
    context.uriFactory.createSnapshotUri(resource.repo, resource.relativePath, revisions[0].id)
  );
  const rightUri = await context.compatibilityService.resolveSnapshotUri(
    context.uriFactory.createSnapshotUri(resource.repo, resource.relativePath, revisions[1].id)
  );

  await vscode.commands.executeCommand('vscode.diff', leftUri, rightUri, diffTitle(resource.relativePath, revisions[0].id, revisions[1].id), {
    viewColumn: vscode.ViewColumn.Active,
    preview: false
  });
}

export async function openSingleSnapshot(context: CommandContext, resource: ResolvedResource): Promise<void> {
  const revision = await context.revisionPickerService.pickSingleRevision(resource);
  if (!revision) {
    return;
  }

  const uri = context.uriFactory.createSnapshotUri(resource.repo, resource.relativePath, revision.id);
  const openUri = await context.compatibilityService.resolveSnapshotUri(uri);
  const document = await vscode.workspace.openTextDocument(openUri);
  await vscode.window.showTextDocument(document, { preview: false, viewColumn: vscode.ViewColumn.Active });
}

export async function openSession(context: CommandContext, resource: ResolvedResource, mode: SessionMode): Promise<void> {
  const revisions = await context.revisionPickerService.pickMultipleRevisions(resource, {
    minSelection: 3,
    placeHolder: `Choose 3 or more revisions for ${mode} mode.`
  });
  if (!revisions) {
    return;
  }

  const session = context.sessionService.createSession(
    resource.repo,
    resource.originalUri,
    resource.relativePath,
    revisions,
    mode,
    getVisiblePairCount()
  );
  await context.nativeDiffSessionController.openSession(session);
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

export function getVisiblePairCount(): number {
  const configuration = vscode.workspace.getConfiguration('multidiff.native');
  const configured = configuration.get<number>('visiblePairCount', 3);
  const max = configuration.get<number>('maxVisiblePairCount', 6);
  return Math.max(1, Math.min(configured, max));
}

export function getRepoCacheId(resource: ResolvedResource): string {
  return toRepoCacheId(resource.repo);
}

function diffTitle(relativePath: string, leftRevision: string, rightRevision: string): string {
  const fileName = relativePath.split('/').at(-1) ?? relativePath;
  return `${fileName} ${leftRevision.slice(0, 8)} ↔ ${rightRevision.slice(0, 8)}`;
}
