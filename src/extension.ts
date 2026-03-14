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
import { SessionService } from './application/sessionService';
import { createClearAllCacheCommand, createClearCurrentRepoCacheCommand } from './commands/clearCache';
import { CommandContext } from './commands/commandContext';
import { createOpenForCurrentFileCommand } from './commands/openForCurrentFile';
import { createOpenForExplorerFileCommand } from './commands/openForExplorerFile';
import { createOpenRevisionSnapshotCommand } from './commands/openRevisionSnapshot';
import { createOpenSessionAdjacentCommand } from './commands/openSessionAdjacent';
import { createOpenSessionBaseCommand } from './commands/openSessionBase';
import { createOpenSnapshotAsTempFileCommand } from './commands/openSnapshotAsTempFile';
import { createShiftWindowLeftCommand } from './commands/shiftWindowLeft';
import { createShiftWindowRightCommand } from './commands/shiftWindowRight';
import { createToggleBlameHeatmapCommand } from './commands/toggleBlameHeatmap';
import { createWarmCacheCommand } from './commands/warmCache';
import { MemoryCache } from './infrastructure/cache/memoryCache';
import { PersistentCache } from './infrastructure/cache/persistentCache';
import { LanguageModeResolver } from './infrastructure/fs/languageModeResolver';
import { SnapshotFsProvider } from './infrastructure/fs/snapshotFsProvider';
import { UriFactory } from './infrastructure/fs/uriFactory';
import { TempSnapshotMirror } from './infrastructure/temp/tempSnapshotMirror';
import { BlameDecorationController } from './presentation/decorations/blameDecorationController';
import { EditorLayoutController } from './presentation/native/editorLayoutController';
import { NativeDiffSessionController } from './presentation/native/nativeDiffSessionController';
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
  const sessionService = new SessionService(uriFactory);
  const tempSnapshotMirror = new TempSnapshotMirror(context.globalStorageUri, repositoryService, uriFactory, cacheService);
  const compatibilityService = new LanguageFeatureCompatibilityService(tempSnapshotMirror);
  const nativeDiffSessionController = new NativeDiffSessionController(
    sessionService,
    new EditorLayoutController(),
    compatibilityService,
    output
  );
  const blameService = new BlameService(repositoryService, cacheService);
  const blameDecorationController = new BlameDecorationController(blameService, output);
  const sessionsTreeProvider = new SessionsTreeProvider(sessionService);
  const cacheTreeProvider = new CacheTreeProvider(cacheService);

  const commandContext: CommandContext = {
    output,
    repositoryService,
    revisionPickerService,
    uriFactory,
    compatibilityService,
    sessionService,
    nativeDiffSessionController,
    cacheService,
    blameDecorationController
  };

  context.subscriptions.push(
    output,
    languageModeResolver,
    compatibilityService,
    blameDecorationController,
    vscode.workspace.registerFileSystemProvider('multidiff', snapshotFsProvider, { isReadonly: true }),
    vscode.window.registerTreeDataProvider('multidiff.sessions', sessionsTreeProvider),
    vscode.window.registerTreeDataProvider('multidiff.cache', cacheTreeProvider),
    vscode.commands.registerCommand('multidiff.openForCurrentFile', createOpenForCurrentFileCommand(commandContext)),
    vscode.commands.registerCommand('multidiff.openForExplorerFile', createOpenForExplorerFileCommand(commandContext)),
    vscode.commands.registerCommand('multidiff.openRevisionSnapshot', createOpenRevisionSnapshotCommand(commandContext)),
    vscode.commands.registerCommand('multidiff.openSessionAdjacent', createOpenSessionAdjacentCommand(commandContext)),
    vscode.commands.registerCommand('multidiff.openSessionBase', createOpenSessionBaseCommand(commandContext)),
    vscode.commands.registerCommand('multidiff.shiftWindowLeft', createShiftWindowLeftCommand(commandContext)),
    vscode.commands.registerCommand('multidiff.shiftWindowRight', createShiftWindowRightCommand(commandContext)),
    vscode.commands.registerCommand('multidiff.toggleBlameHeatmap', createToggleBlameHeatmapCommand(commandContext)),
    vscode.commands.registerCommand('multidiff.cache.warmCurrentFile', createWarmCacheCommand(commandContext)),
    vscode.commands.registerCommand('multidiff.cache.clearCurrentRepo', createClearCurrentRepoCacheCommand(commandContext)),
    vscode.commands.registerCommand('multidiff.cache.clearAll', createClearAllCacheCommand(commandContext)),
    vscode.commands.registerCommand('multidiff.compatibility.openSnapshotAsTempFile', createOpenSnapshotAsTempFileCommand(commandContext))
  );

  output.info('MultiDiffViewer activated.');
}

export function deactivate(): void {
  // Handled by VS Code disposables.
}
