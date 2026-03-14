import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';

import { CacheService } from '../../application/cacheService';
import { RepositoryService } from '../../application/repositoryService';
import { createSnapshotCacheKey } from '../cache/cacheKeys';
import { UriFactory } from '../fs/uriFactory';

export class TempSnapshotMirror implements vscode.Disposable {
  private readonly rootPath: string;

  public constructor(
    storageUri: vscode.Uri,
    private readonly repositoryService: RepositoryService,
    private readonly uriFactory: UriFactory,
    private readonly cacheService: CacheService
  ) {
    this.rootPath = path.join(storageUri.fsPath, 'temp');
  }

  public async mirror(snapshotUri: vscode.Uri): Promise<vscode.Uri> {
    if (snapshotUri.scheme !== 'multidiff') {
      return snapshotUri;
    }

    const parsed = this.uriFactory.parseSnapshotUri(snapshotUri);
    const repo = this.repositoryService.getRepoFromSnapshot(parsed);
    if (!repo) {
      throw new Error(`Repository is not registered for ${snapshotUri.toString()}`);
    }

    const adapter = this.repositoryService.getAdapter(parsed.kind);
    const bytes = await this.cacheService.getOrLoadBytes(
      createSnapshotCacheKey(repo, parsed.relativePath, parsed.revision),
      () => adapter.getSnapshot(repo, parsed.relativePath, parsed.revision)
    );

    const filePath = path.join(this.rootPath, `${parsed.kind}-${parsed.repoId}`, parsed.revision, parsed.relativePath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, Buffer.from(bytes.value));
    return vscode.Uri.file(filePath);
  }

  public dispose(): void {
    void fs.rm(this.rootPath, { recursive: true, force: true });
  }
}
