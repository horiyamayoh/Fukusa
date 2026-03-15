import * as vscode from 'vscode';

import { CacheService } from '../../application/cacheService';
import { RepositoryService } from '../../application/repositoryService';
import { OutputLogger } from '../../util/output';
import { createSnapshotCacheKey } from '../cache/cacheKeys';
import { UriFactory } from './uriFactory';

export class SnapshotFsProvider implements vscode.FileSystemProvider {
  private readonly onDidChangeFileEmitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();

  public readonly onDidChangeFile = this.onDidChangeFileEmitter.event;

  public constructor(
    private readonly repositoryService: RepositoryService,
    private readonly uriFactory: UriFactory,
    private readonly cacheService: CacheService,
    private readonly output: OutputLogger
  ) {}

  public watch(): vscode.Disposable {
    return new vscode.Disposable(() => undefined);
  }

  public async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
    this.resolveSnapshot(uri);
    return {
      type: vscode.FileType.File,
      ctime: 0,
      mtime: 0,
      size: 0
    };
  }

  public async readFile(uri: vscode.Uri): Promise<Uint8Array> {
    const { parsed, repo, adapter } = this.resolveSnapshot(uri);

    try {
      const result = await this.cacheService.getOrLoadBytes(
        createSnapshotCacheKey(repo, parsed.relativePath, parsed.revision),
        () => adapter.getSnapshot(repo, parsed.relativePath, parsed.revision)
      );

      return result.value;
    } catch (error) {
      if (error instanceof vscode.FileSystemError) {
        throw error;
      }

      const message = `Failed to load snapshot ${parsed.relativePath}@${parsed.revision}.`;
      this.output.error(message, error);
      throw vscode.FileSystemError.Unavailable(`${message} ${toErrorMessage(error)}`.trim());
    }
  }

  public readDirectory(): [string, vscode.FileType][] {
    return [];
  }

  public createDirectory(): void {
    throw vscode.FileSystemError.NoPermissions('Fukusa snapshots are readonly.');
  }

  public writeFile(): void {
    throw vscode.FileSystemError.NoPermissions('Fukusa snapshots are readonly.');
  }

  public delete(): void {
    throw vscode.FileSystemError.NoPermissions('Fukusa snapshots are readonly.');
  }

  public rename(): void {
    throw vscode.FileSystemError.NoPermissions('Fukusa snapshots are readonly.');
  }

  private resolveSnapshot(uri: vscode.Uri): {
    readonly parsed: ReturnType<UriFactory['parseSnapshotUri']>;
    readonly repo: NonNullable<ReturnType<RepositoryService['getRepoFromSnapshot']>>;
    readonly adapter: ReturnType<RepositoryService['getAdapter']>;
  } {
    let parsed: ReturnType<UriFactory['parseSnapshotUri']>;
    try {
      parsed = this.uriFactory.parseSnapshotUri(uri);
    } catch (error) {
      throw vscode.FileSystemError.FileNotFound(`Malformed snapshot URI: ${toErrorMessage(error)}`);
    }

    const repo = this.repositoryService.getRepoFromSnapshot(parsed);
    if (!repo) {
      throw vscode.FileSystemError.FileNotFound(`Snapshot repository is not registered: ${uri.toString()}`);
    }

    return {
      parsed,
      repo,
      adapter: this.repositoryService.getAdapter(parsed.kind)
    };
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
