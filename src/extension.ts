import * as vscode from 'vscode';

import { GitAdapter } from './adapters/git/gitAdapter';
import { GitApiService } from './adapters/git/gitApi';
import { GitCli } from './adapters/git/gitCli';
import { SvnAdapter } from './adapters/svn/svnAdapter';
import { SvnCli } from './adapters/svn/svnCli';
import { BlameService } from './application/blameService';
import { CacheService } from './application/cacheService';
import { LanguageFeatureCompatibilityService } from './application/languageFeatureCompatibilityService';
import { RepositoryRegistry } from './application/repositoryRegistry';
import { RepositoryService } from './application/repositoryService';
import { RevisionPickerService } from './application/revisionPickerService';
import { SessionAlignmentService } from './application/sessionAlignmentService';
import { SessionBuilderService } from './application/sessionBuilderService';
import { SessionService } from './application/sessionService';
import { createBrowseRevisionsCommand } from './commands/browseRevisions';
import { createBrowseRevisionsSingleTabCommand } from './commands/browseRevisionsSingleTab';
import { createChangePairProjectionCommand } from './commands/changePairProjection';
import { createClearAllCacheCommand, createClearCurrentRepoCacheCommand } from './commands/clearCache';
import { createCloseActiveSessionCommand } from './commands/closeActiveSession';
import { CommandContext } from './commands/commandContext';
import { createExpandAllCollapsedGapsCommand } from './commands/expandAllCollapsedGaps';
import { createOpenForCurrentFileCommand } from './commands/openForCurrentFile';
import { createOpenForExplorerFileCommand } from './commands/openForExplorerFile';
import { createOpenActiveSessionPairDiffCommand } from './commands/openActiveSessionPairDiff';
import { createOpenActiveSessionSnapshotCommand } from './commands/openActiveSessionSnapshot';
import { createOpenRevisionSnapshotCommand } from './commands/openRevisionSnapshot';
import { createResetExpandedGapsCommand } from './commands/resetExpandedGaps';
import { createOpenSessionAdjacentCommand } from './commands/openSessionAdjacent';
import { createOpenSessionBaseCommand } from './commands/openSessionBase';
import { createOpenSnapshotAsTempFileCommand } from './commands/openSnapshotAsTempFile';
import { createRevealSessionCommand } from './commands/revealSession';
import { createShiftWindowLeftCommand } from './commands/shiftWindowLeft';
import { createShiftWindowRightCommand } from './commands/shiftWindowRight';
import { SessionCommandContextController } from './commands/sessionCommandContextController';
import { createSwitchCompareSurfaceCommand } from './commands/switchCompareSurface';
import { createToggleBlameHeatmapCommand } from './commands/toggleBlameHeatmap';
import { createToggleCollapseUnchangedCommand } from './commands/toggleCollapseUnchanged';
import { createWarmCacheCommand } from './commands/warmCache';
import { MemoryCache } from './infrastructure/cache/memoryCache';
import { AlignedSessionDocumentProvider } from './infrastructure/fs/alignedSessionDocumentProvider';
import { PersistentCache } from './infrastructure/cache/persistentCache';
import { LanguageModeResolver } from './infrastructure/fs/languageModeResolver';
import { SnapshotFsProvider } from './infrastructure/fs/snapshotFsProvider';
import { UriFactory } from './infrastructure/fs/uriFactory';
import { ShadowWorkspaceService } from './infrastructure/shadow/shadowWorkspaceService';
import { TempSnapshotMirror } from './infrastructure/temp/tempSnapshotMirror';
import { BlameDecorationController } from './presentation/decorations/blameDecorationController';
import { CompareSurfaceCoordinator } from './presentation/compare/compareSurfaceCoordinator';
import { PanelCompareSessionController } from './presentation/compare/panelCompareSessionController';
import { DiffDecorationController } from './presentation/native/diffDecorationController';
import { EditorLayoutController } from './presentation/native/editorLayoutController';
import { EditorSyncController } from './presentation/native/editorSyncController';
import { NativeCompareSessionController } from './presentation/native/nativeCompareSessionController';
import { CacheTreeProvider } from './presentation/views/cacheTreeProvider';
import { SessionsTreeProvider } from './presentation/views/sessionsTreeProvider';
import { OutputLogger } from './util/output';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  await vscode.workspace.fs.createDirectory(context.globalStorageUri);

  const output = new OutputLogger();
  const repositoryRegistry = new RepositoryRegistry();
  const uriFactory = new UriFactory(repositoryRegistry);

  const gitAdapter = new GitAdapter(new GitApiService(), new GitCli(), output);
  const svnAdapter = new SvnAdapter(new SvnCli(), output);
  const repositoryService = new RepositoryService([gitAdapter, svnAdapter], repositoryRegistry, uriFactory);

  const memoryMaxSizeMb = vscode.workspace.getConfiguration('multidiff.cache').get<number>('maxSizeMb', 512);
  const memoryCache = new MemoryCache(memoryMaxSizeMb * 1024 * 1024);
  const persistentCache = new PersistentCache(context.globalStorageUri);
  const cacheService = new CacheService(memoryCache, persistentCache, output);

  const snapshotFsProvider = new SnapshotFsProvider(repositoryService, uriFactory, cacheService, output);
  const languageModeResolver = new LanguageModeResolver(uriFactory);
  const revisionPickerService = new RevisionPickerService(repositoryService, cacheService);
  const sessionService = new SessionService();
  const alignedSessionDocumentProvider = new AlignedSessionDocumentProvider(sessionService, uriFactory, output);
  const alignmentService = new SessionAlignmentService();
  const shadowWorkspaceService = new ShadowWorkspaceService(repositoryService, output);
  const tempSnapshotMirror = new TempSnapshotMirror(context.globalStorageUri, repositoryService, uriFactory, cacheService);
  const compatibilityService = new LanguageFeatureCompatibilityService(tempSnapshotMirror);
  const blameService = new BlameService(repositoryService, cacheService);
  const sessionBuilderService = new SessionBuilderService(
    repositoryService,
    cacheService,
    blameService,
    uriFactory,
    alignmentService,
    shadowWorkspaceService,
    sessionService,
    output
  );
  const blameDecorationController = new BlameDecorationController(blameService, sessionService, output);
  const diffDecorationController = new DiffDecorationController(sessionService);
  const editorSyncController = new EditorSyncController(sessionService);
  const nativeCompareSessionController = new NativeCompareSessionController(
    sessionService,
    uriFactory,
    new EditorLayoutController(),
    diffDecorationController,
    editorSyncController,
    output
  );
  const panelCompareSessionController = new PanelCompareSessionController(context.extensionUri, sessionService, output);
  const compareSessionController = new CompareSurfaceCoordinator(
    sessionService,
    nativeCompareSessionController,
    panelCompareSessionController
  );
  const sessionsTreeProvider = new SessionsTreeProvider(sessionService);
  const cacheTreeProvider = new CacheTreeProvider(cacheService);
  const sessionCommandContextController = new SessionCommandContextController(sessionService);

  const commandContext: CommandContext = {
    output,
    repositoryService,
    revisionPickerService,
    uriFactory,
    compatibilityService,
    sessionBuilderService,
    sessionService,
    compareSessionController,
    cacheService,
    blameDecorationController
  };

  context.subscriptions.push(
    output,
    languageModeResolver,
    compatibilityService,
    shadowWorkspaceService,
    blameDecorationController,
    diffDecorationController,
    editorSyncController,
    nativeCompareSessionController,
    panelCompareSessionController,
    compareSessionController,
    sessionCommandContextController,
    vscode.workspace.registerFileSystemProvider('multidiff', snapshotFsProvider, { isReadonly: true }),
    vscode.workspace.registerTextDocumentContentProvider('multidiff-session-doc', alignedSessionDocumentProvider),
    vscode.window.registerTreeDataProvider('multidiff.sessions', sessionsTreeProvider),
    vscode.window.registerTreeDataProvider('multidiff.cache', cacheTreeProvider),
    vscode.commands.registerCommand('multidiff.browseRevisions', createBrowseRevisionsCommand(commandContext)),
    vscode.commands.registerCommand('multidiff.browseRevisionsSingleTab', createBrowseRevisionsSingleTabCommand(commandContext)),
    vscode.commands.registerCommand('multidiff.changePairProjection', createChangePairProjectionCommand(commandContext)),
    vscode.commands.registerCommand('multidiff.closeActiveSession', createCloseActiveSessionCommand(commandContext)),
    vscode.commands.registerCommand('multidiff.expandAllCollapsedGaps', createExpandAllCollapsedGapsCommand(commandContext)),
    vscode.commands.registerCommand('multidiff.openActiveSessionSnapshot', createOpenActiveSessionSnapshotCommand(commandContext)),
    vscode.commands.registerCommand('multidiff.openActiveSessionPairDiff', createOpenActiveSessionPairDiffCommand(commandContext)),
    vscode.commands.registerCommand('multidiff.openForCurrentFile', createOpenForCurrentFileCommand(commandContext)),
    vscode.commands.registerCommand('multidiff.openForExplorerFile', createOpenForExplorerFileCommand(commandContext)),
    vscode.commands.registerCommand('multidiff.openRevisionSnapshot', createOpenRevisionSnapshotCommand(commandContext)),
    vscode.commands.registerCommand('multidiff.openSessionAdjacent', createOpenSessionAdjacentCommand(commandContext)),
    vscode.commands.registerCommand('multidiff.openSessionBase', createOpenSessionBaseCommand(commandContext)),
    vscode.commands.registerCommand('multidiff.resetExpandedGaps', createResetExpandedGapsCommand(commandContext)),
    vscode.commands.registerCommand('multidiff.internal.revealSession', createRevealSessionCommand(commandContext)),
    vscode.commands.registerCommand('multidiff.internal.changePairProjection', createChangePairProjectionCommand(commandContext)),
    vscode.commands.registerCommand('multidiff.internal.closeSession', createCloseActiveSessionCommand(commandContext)),
    vscode.commands.registerCommand('multidiff.internal.expandAllCollapsedGaps', createExpandAllCollapsedGapsCommand(commandContext)),
    vscode.commands.registerCommand('multidiff.internal.openSessionPairDiff', createOpenActiveSessionPairDiffCommand(commandContext)),
    vscode.commands.registerCommand('multidiff.internal.openSessionSnapshot', createOpenActiveSessionSnapshotCommand(commandContext)),
    vscode.commands.registerCommand('multidiff.internal.resetExpandedGaps', createResetExpandedGapsCommand(commandContext)),
    vscode.commands.registerCommand('multidiff.internal.shiftWindowLeft', createShiftWindowLeftCommand(commandContext)),
    vscode.commands.registerCommand('multidiff.internal.shiftWindowRight', createShiftWindowRightCommand(commandContext)),
    vscode.commands.registerCommand('multidiff.internal.switchCompareSurface', createSwitchCompareSurfaceCommand(commandContext)),
    vscode.commands.registerCommand('multidiff.internal.toggleCollapseUnchanged', createToggleCollapseUnchangedCommand(commandContext)),
    vscode.commands.registerCommand('multidiff.shiftWindowLeft', createShiftWindowLeftCommand(commandContext)),
    vscode.commands.registerCommand('multidiff.shiftWindowRight', createShiftWindowRightCommand(commandContext)),
    vscode.commands.registerCommand('multidiff.switchCompareSurface', createSwitchCompareSurfaceCommand(commandContext)),
    vscode.commands.registerCommand('multidiff.toggleBlameHeatmap', createToggleBlameHeatmapCommand(commandContext)),
    vscode.commands.registerCommand('multidiff.toggleCollapseUnchanged', createToggleCollapseUnchangedCommand(commandContext)),
    vscode.commands.registerCommand('multidiff.cache.warmCurrentFile', createWarmCacheCommand(commandContext)),
    vscode.commands.registerCommand('multidiff.cache.clearCurrentRepo', createClearCurrentRepoCacheCommand(commandContext)),
    vscode.commands.registerCommand('multidiff.cache.clearAll', createClearAllCacheCommand(commandContext)),
    vscode.commands.registerCommand('multidiff.compatibility.openSnapshotAsTempFile', createOpenSnapshotAsTempFileCommand(commandContext))
  );

  output.info('Fukusa activated.');
}

export function deactivate(): void {
  // Handled by VS Code disposables.
}
