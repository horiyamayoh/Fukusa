import * as path from 'path';
import * as vscode from 'vscode';

import { ParsedSnapshotUri, RepoContext } from '../../adapters/common/types';
import { RepositoryRegistry } from '../../application/repositoryRegistry';

function toDisplayPath(relativePath: string, revision: string): string {
  const parsed = path.posix.parse(relativePath);
  const displayName = `${parsed.name} (${revision.slice(0, 8)})${parsed.ext}`;
  return path.posix.join(parsed.dir, displayName);
}

export class UriFactory {
  public constructor(private readonly repositoryRegistry: RepositoryRegistry) {}

  public createSnapshotUri(repo: RepoContext, relativePath: string, revision: string): vscode.Uri {
    this.repositoryRegistry.register(repo);

    const normalizedRelativePath = relativePath.split(path.sep).join(path.posix.sep);
    const displayRelativePath = toDisplayPath(normalizedRelativePath, revision);
    const query = new URLSearchParams({
      rev: revision,
      path: normalizedRelativePath
    });

    return vscode.Uri.from({
      scheme: 'multidiff',
      authority: repo.kind,
      path: `/${repo.repoId}/${displayRelativePath}`,
      query: query.toString()
    });
  }

  public parseSnapshotUri(uri: vscode.Uri): ParsedSnapshotUri {
    if (uri.scheme !== 'multidiff') {
      throw new Error(`Unsupported snapshot URI scheme: ${uri.toString()}`);
    }

    const segments = uri.path.split('/').filter(Boolean);
    if (segments.length < 2) {
      throw new Error(`Malformed snapshot URI path: ${uri.path}`);
    }

    const query = new URLSearchParams(uri.query);
    const revision = query.get('rev');
    if (!revision) {
      throw new Error(`Snapshot URI is missing revision query: ${uri.toString()}`);
    }

    const displayRelativePath = segments.slice(1).join('/');
    const relativePath = query.get('path') ?? displayRelativePath;

    return {
      kind: uri.authority as ParsedSnapshotUri['kind'],
      repoId: segments[0],
      relativePath,
      displayRelativePath,
      revision
    };
  }
}
