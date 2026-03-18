import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';

import { RepoContext } from '../../adapters/common/types';
import { RepositoryService } from '../../application/repositoryService';
import { OutputLogger } from '../../util/output';

function normalizeRelativePath(relativePath: string): string {
  return relativePath.split('/').join(path.sep);
}

function sanitizePathSegment(value: string): string {
  return [...value].map((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint < 0x20 || '<>:"/\\|?*'.includes(character)) {
      return '_';
    }

    return character;
  }).join('');
}

export class ShadowWorkspaceService implements vscode.Disposable {
  private readonly attemptedLegacyCleanupRepoRoots = new Set<string>();

  public constructor(
    private readonly repositoryService: RepositoryService,
    private readonly output: OutputLogger
  ) {}

  public async cleanupSessionArtifacts(repo: RepoContext): Promise<void> {
    await this.removeDirectory(path.join(this.getShadowBase(repo), 'sessions'));
  }

  public async materializeRevisionTree(repo: RepoContext, revision: string): Promise<vscode.Uri> {
    await this.ensureShadowWorkspaceReady(repo);

    const targetRoot = this.getRevisionRoot(repo, revision);
    const markerPath = path.join(targetRoot, '.fukusa-complete');

    try {
      await fs.access(markerPath);
      return vscode.Uri.file(targetRoot);
    } catch {
      // Materialize on demand below.
    }

    await fs.mkdir(path.dirname(targetRoot), { recursive: true });
    await this.makeWritableRecursive(targetRoot);
    await this.repositoryService.getAdapter(repo.kind).materializeRevisionTree(repo, revision, targetRoot);
    await this.markReadonlyRecursive(targetRoot);
    await fs.writeFile(markerPath, revision, 'utf8');
    await fs.chmod(markerPath, 0o444).catch(() => undefined);
    this.output.info(`Materialized ${repo.kind} revision ${revision} at ${targetRoot}`);
    return vscode.Uri.file(targetRoot);
  }

  public async writeRawFile(
    repo: RepoContext,
    revision: string,
    relativePath: string,
    bytes: Uint8Array
  ): Promise<vscode.Uri> {
    await this.ensureShadowWorkspaceReady(repo);

    const rootPath = this.getRevisionRoot(repo, revision);
    const filePath = path.join(rootPath, normalizeRelativePath(relativePath));
    await this.makeWritableRecursive(rootPath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.chmod(filePath, 0o666).catch(() => undefined);
    await fs.writeFile(filePath, Buffer.from(bytes));
    await fs.chmod(filePath, 0o444).catch(() => undefined);
    return vscode.Uri.file(filePath);
  }

  public async getRawFileUri(repo: RepoContext, revision: string, relativePath: string): Promise<vscode.Uri> {
    await this.ensureShadowWorkspaceReady(repo);

    const filePath = path.join(this.getRevisionRoot(repo, revision), normalizeRelativePath(relativePath));
    await fs.access(filePath);
    return vscode.Uri.file(filePath);
  }

  public dispose(): void {
    // Raw shadow snapshots intentionally persist between sessions.
  }

  private getShadowBase(repo: RepoContext): string {
    return path.join(repo.repoRoot, '.fukusa-shadow');
  }

  private getRevisionRoot(repo: RepoContext, revision: string): string {
    return path.join(this.getShadowBase(repo), 'revisions', sanitizePathSegment(revision));
  }

  private async ensureShadowWorkspaceReady(repo: RepoContext): Promise<void> {
    await fs.mkdir(this.getShadowBase(repo), { recursive: true });

    if (repo.kind !== 'git' || this.attemptedLegacyCleanupRepoRoots.has(repo.repoRoot)) {
      return;
    }

    this.attemptedLegacyCleanupRepoRoots.add(repo.repoRoot);
    await this.cleanupLegacyGitShadow(repo);
  }

  private async markReadonlyRecursive(rootPath: string): Promise<void> {
    const exists = await fs.stat(rootPath).then(() => true).catch(() => false);
    if (!exists) {
      return;
    }

    const entries = await fs.readdir(rootPath, { withFileTypes: true });
    for (const entry of entries) {
      const targetPath = path.join(rootPath, entry.name);
      if (entry.isDirectory()) {
        await this.markReadonlyRecursive(targetPath);
        await fs.chmod(targetPath, 0o555).catch(() => undefined);
        continue;
      }

      await fs.chmod(targetPath, 0o444).catch(() => undefined);
    }
  }

  private async makeWritableRecursive(rootPath: string): Promise<void> {
    const exists = await fs.stat(rootPath).then(() => true).catch(() => false);
    if (!exists) {
      return;
    }

    await fs.chmod(rootPath, 0o755).catch(() => undefined);
    const entries = await fs.readdir(rootPath, { withFileTypes: true });
    for (const entry of entries) {
      const targetPath = path.join(rootPath, entry.name);
      if (entry.isDirectory()) {
        await fs.chmod(targetPath, 0o755).catch(() => undefined);
        await this.makeWritableRecursive(targetPath);
        continue;
      }

      await fs.chmod(targetPath, 0o666).catch(() => undefined);
    }
  }

  private async cleanupLegacyGitShadow(repo: RepoContext): Promise<void> {
    const legacyPath = path.join(repo.repoRoot, '.git', 'fukusa-shadow');
    const exists = await fs.stat(legacyPath).then(() => true).catch(() => false);
    if (!exists) {
      return;
    }

    await fs.chmod(legacyPath, 0o755).catch(() => undefined);
    await this.makeWritableRecursive(legacyPath);

    try {
      await this.removeDirectory(legacyPath);
      this.output.info(`Removed legacy Git shadow workspace at ${legacyPath}`);
    } catch (error) {
      if (isNonBlockingLegacyCleanupError(error)) {
        this.output.warn(`Legacy Git shadow cleanup skipped for ${legacyPath}: ${toErrorMessage(error)}`);
        return;
      }

      throw error;
    }
  }

  protected async removeDirectory(targetPath: string): Promise<void> {
    await fs.rm(targetPath, { recursive: true, force: true });
  }
}

function isNonBlockingLegacyCleanupError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return code === 'EPERM' || code === 'EBUSY' || code === 'ENOTEMPTY' || code === 'EACCES';
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
