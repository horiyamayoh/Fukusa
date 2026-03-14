import * as vscode from 'vscode';

import { CacheService } from '../../application/cacheService';
import { RepositoryService } from '../../application/repositoryService';
import { createSnapshotCacheKey } from '../cache/cacheKeys';
import { UriFactory } from './uriFactory';

export class SnapshotFsProvider implements vscode.FileSystemProvider {
  private readonly onDidChangeFileEmitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();

  public readonly onDidChangeFile = this.onDidChangeFileEmitter.event;

  public constructor(
    private readonly repositoryService: RepositoryService,
    private readonly uriFactory: UriFactory,
    private readonly cacheService: CacheService
  ) {}

  public watch(): vscode.Disposable {
    return new vscode.Disposable(() => undefined);
  }

  public async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
    const bytes = await this.readFile(uri);
    return {
      type: vscode.FileType.File,
      ctime: 0,
      mtime: 0,
      size: bytes.byteLength
    };
  }

  public async readFile(uri: vscode.Uri): Promise<Uint8Array> {
    const parsed = this.uriFactory.parseSnapshotUri(uri);
    const repo = this.repositoryService.getRepoFromSnapshot(parsed);
    if (!repo) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }

    const adapter = this.repositoryService.getAdapter(parsed.kind);
    const result = await this.cacheService.getOrLoadBytes(
      createSnapshotCacheKey(repo, parsed.relativePath, parsed.revision),
      () => adapter.getSnapshot(repo, parsed.relativePath, parsed.revision)
    );

    return result.value;
  }

  public readDirectory(): [string, vscode.FileType][] {
    return [];
  }

  public createDirectory(): void {
    throw vscode.FileSystemError.NoPermissions('MultiDiff snapshots are readonly.');
  }

  public writeFile(): void {
    throw vscode.FileSystemError.NoPermissions('MultiDiff snapshots are readonly.');
  }

  public delete(): void {
    throw vscode.FileSystemError.NoPermissions('MultiDiff snapshots are readonly.');
  }

  public rename(): void {
    throw vscode.FileSystemError.NoPermissions('MultiDiff snapshots are readonly.');
  }
}
