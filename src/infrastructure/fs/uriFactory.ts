import * as path from 'path';
import * as vscode from 'vscode';

import { ParsedSessionDocumentUri, ParsedSessionUri, ParsedSnapshotUri, RepoContext, RepositoryKind } from '../../adapters/common/types';
import { RepositoryRegistry } from '../../application/repositoryRegistry';

function toDisplayPath(relativePath: string, revision: string): string {
  const parsed = path.posix.parse(relativePath);
  const displayName = `${parsed.name} (${revision.slice(0, 8)})${parsed.ext}`;
  return path.posix.join(parsed.dir, displayName);
}

function parseRepositoryKind(authority: string): RepositoryKind {
  if (authority === 'git' || authority === 'svn') {
    return authority;
  }

  throw new Error(`Unsupported snapshot URI authority: ${authority}`);
}

function normalizeRelativeSnapshotPath(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, '/');
  if (!normalized || path.posix.isAbsolute(normalized) || normalized.split('/').some((segment) => segment === '..')) {
    throw new Error(`Invalid snapshot relative path: ${relativePath}`);
  }

  const cleaned = path.posix.normalize(normalized);
  if (cleaned === '.' || cleaned.startsWith('../')) {
    throw new Error(`Invalid snapshot relative path: ${relativePath}`);
  }

  return cleaned;
}

export class UriFactory {
  public constructor(private readonly repositoryRegistry: RepositoryRegistry) {}

  public createSnapshotUri(repo: RepoContext, relativePath: string, revision: string): vscode.Uri {
    this.repositoryRegistry.register(repo);

    const normalizedRelativePath = normalizeRelativeSnapshotPath(relativePath.split(path.sep).join(path.posix.sep));
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
    const relativePath = normalizeRelativeSnapshotPath(query.get('path') ?? displayRelativePath);

    return {
      kind: parseRepositoryKind(uri.authority),
      repoId: segments[0],
      relativePath,
      displayRelativePath,
      revision
    };
  }

  public createSessionUri(sessionId: string, relativePath: string): vscode.Uri {
    const normalizedRelativePath = normalizeRelativeSnapshotPath(relativePath.split(path.sep).join(path.posix.sep));
    const query = new URLSearchParams({
      path: normalizedRelativePath
    });

    return vscode.Uri.from({
      scheme: 'multidiff-session',
      authority: sessionId,
      path: `/${normalizedRelativePath}`,
      query: query.toString()
    });
  }

  public parseSessionUri(uri: vscode.Uri): ParsedSessionUri {
    if (uri.scheme !== 'multidiff-session') {
      throw new Error(`Unsupported session URI scheme: ${uri.toString()}`);
    }

    return {
      sessionId: uri.authority,
      relativePath: normalizeRelativeSnapshotPath(new URLSearchParams(uri.query).get('path') ?? uri.path)
    };
  }

  public createSessionDocumentUri(
    sessionId: string,
    windowStart: number,
    revisionIndex: number,
    relativePath: string,
    revisionLabel: string
  ): vscode.Uri {
    const normalizedRelativePath = normalizeRelativeSnapshotPath(relativePath.split(path.sep).join(path.posix.sep));
    const fileName = path.posix.basename(normalizedRelativePath);
    const query = new URLSearchParams({
      path: normalizedRelativePath,
      windowStart: String(windowStart),
      revisionIndex: String(revisionIndex),
      revisionLabel
    });

    return vscode.Uri.from({
      scheme: 'multidiff-session-doc',
      authority: sessionId,
      path: `/${revisionIndex.toString().padStart(2, '0')}-${fileName}`,
      query: query.toString()
    });
  }

  public parseSessionDocumentUri(uri: vscode.Uri): ParsedSessionDocumentUri {
    if (uri.scheme !== 'multidiff-session-doc') {
      throw new Error(`Unsupported session document URI scheme: ${uri.toString()}`);
    }

    const query = new URLSearchParams(uri.query);
    const windowStart = Number(query.get('windowStart') ?? '');
    const revisionIndex = Number(query.get('revisionIndex') ?? '');
    const revisionLabel = query.get('revisionLabel') ?? '';
    if (!Number.isFinite(windowStart) || !Number.isFinite(revisionIndex)) {
      throw new Error(`Malformed session document URI query: ${uri.toString()}`);
    }

    return {
      sessionId: uri.authority,
      windowStart,
      revisionIndex,
      relativePath: normalizeRelativeSnapshotPath(query.get('path') ?? uri.path),
      revisionLabel
    };
  }
}
