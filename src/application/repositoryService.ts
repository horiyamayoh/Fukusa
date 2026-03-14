import * as path from 'path';
import * as vscode from 'vscode';

import {
  ParsedSnapshotUri,
  RepoContext,
  RepositoryKind,
  ResolvedResource
} from '../adapters/common/types';
import { IRepositoryAdapter } from '../adapters/common/repositoryAdapter';
import { RepositoryRegistry } from './repositoryRegistry';
import { UriFactory } from '../infrastructure/fs/uriFactory';

export class RepositoryService {
  private readonly adapters = new Map<RepositoryKind, IRepositoryAdapter>();

  public constructor(
    adapters: readonly IRepositoryAdapter[],
    private readonly registry: RepositoryRegistry,
    private readonly uriFactory: UriFactory
  ) {
    for (const adapter of adapters) {
      this.adapters.set(adapter.kind, adapter);
    }
  }

  public getAdapter(kind: RepositoryKind): IRepositoryAdapter {
    const adapter = this.adapters.get(kind);
    if (!adapter) {
      throw new Error(`Repository adapter not registered for ${kind}.`);
    }

    return adapter;
  }

  public async resolveResource(uri: vscode.Uri): Promise<ResolvedResource | undefined> {
    if (uri.scheme === 'file') {
      for (const adapter of this.adapters.values()) {
        const repo = await adapter.resolveRepoContext(uri);
        if (!repo) {
          continue;
        }

        this.registry.register(repo);
        return {
          repo,
          relativePath: path.relative(repo.repoRoot, uri.fsPath).split(path.sep).join(path.posix.sep),
          originalUri: uri
        };
      }

      return undefined;
    }

    if (uri.scheme === 'multidiff') {
      const parsed = this.uriFactory.parseSnapshotUri(uri);
      const repo = this.registry.get(parsed.kind, parsed.repoId);
      if (!repo) {
        return undefined;
      }

      return {
        repo,
        relativePath: parsed.relativePath,
        originalUri: uri,
        revision: parsed.revision
      };
    }

    return undefined;
  }

  public getRepoFromSnapshot(parsed: ParsedSnapshotUri): RepoContext | undefined {
    return this.registry.get(parsed.kind, parsed.repoId);
  }
}
