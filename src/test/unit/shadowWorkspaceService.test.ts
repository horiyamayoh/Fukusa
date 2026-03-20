import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as sinon from 'sinon';

import { RepoContext } from '../../adapters/common/types';
import { RepositoryService } from '../../application/repositoryService';
import { ShadowWorkspaceService } from '../../infrastructure/shadow/shadowWorkspaceService';
import { OutputLogger } from '../../util/output';

suite('Unit: ShadowWorkspaceService', () => {
  teardown(() => {
    sinon.restore();
  });

  test('writes Git raw snapshots under repo-local .fukusa-shadow and removes legacy .git storage', async () => {
    const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'fukusa-shadow-'));
    const legacyRoot = path.join(repoRoot, '.git', 'fukusa-shadow');
    await fs.mkdir(legacyRoot, { recursive: true });
    await fs.writeFile(path.join(legacyRoot, 'legacy.txt'), 'legacy', 'utf8');

    const service = new ShadowWorkspaceService({} as RepositoryService, new OutputLogger('ShadowWorkspaceService Test'));
    const repo = createRepo(repoRoot);

    const rawUri = await service.writeRawFile(repo, 'rev-1', 'src/sample.ts', Buffer.from('const value = 1;\n', 'utf8'));

    assert.ok(rawUri.fsPath.includes(`${path.sep}.fukusa-shadow${path.sep}revisions${path.sep}rev-1`));
    await fs.access(rawUri.fsPath);
    const legacyExists = await fs.stat(legacyRoot).then(() => true).catch(() => false);
    assert.strictEqual(legacyExists, false);

    await cleanupTempRepo(repoRoot);
  });

  test('continues writing raw files when legacy Git shadow cleanup fails and only attempts cleanup once per repo', async () => {
    const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'fukusa-shadow-'));
    const legacyRoot = path.join(repoRoot, '.git', 'fukusa-shadow');
    await fs.mkdir(path.join(legacyRoot, 'locked'), { recursive: true });
    await fs.writeFile(path.join(legacyRoot, 'locked', 'legacy.txt'), 'legacy', 'utf8');

    const output = new OutputLogger('ShadowWorkspaceService Test');
    const warnStub = sinon.stub(output, 'warn');
    let legacyCleanupAttempts = 0;
    const service = new TestShadowWorkspaceService({} as RepositoryService, output, async (targetPath, fallback) => {
      if (targetPath === legacyRoot) {
        legacyCleanupAttempts += 1;
        throw createErrnoError('EPERM', `EPERM: operation not permitted, rmdir '${legacyRoot}'`);
      }

      await fallback(targetPath);
    });
    const repo = createRepo(repoRoot);

    const firstRawUri = await service.writeRawFile(repo, 'rev-1', 'src/sample.ts', Buffer.from('const value = 1;\n', 'utf8'));
    const secondRawUri = await service.writeRawFile(repo, 'rev-2', 'src/sample.ts', Buffer.from('const value = 2;\n', 'utf8'));

    assert.ok(firstRawUri.fsPath.includes(`${path.sep}.fukusa-shadow${path.sep}revisions${path.sep}rev-1`));
    assert.ok(secondRawUri.fsPath.includes(`${path.sep}.fukusa-shadow${path.sep}revisions${path.sep}rev-2`));
    await fs.access(firstRawUri.fsPath);
    await fs.access(secondRawUri.fsPath);
    assert.strictEqual(legacyCleanupAttempts, 1);
    assert.strictEqual(warnStub.callCount, 1);
    assert.match(String(warnStub.firstCall.args[0]), /Legacy Git shadow cleanup skipped/);

    await cleanupTempRepo(repoRoot);
  });

  test('continues materializing revision trees when legacy Git shadow cleanup fails', async () => {
    const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'fukusa-shadow-'));
    const legacyRoot = path.join(repoRoot, '.git', 'fukusa-shadow');
    await fs.mkdir(path.join(legacyRoot, 'locked'), { recursive: true });
    await fs.writeFile(path.join(legacyRoot, 'locked', 'legacy.txt'), 'legacy', 'utf8');

    const output = new OutputLogger('ShadowWorkspaceService Test');
    const warnStub = sinon.stub(output, 'warn');
    const service = new TestShadowWorkspaceService({
      getAdapter: () => ({
        materializeRevisionTree: async (_repo: RepoContext, _revision: string, targetRoot: string): Promise<void> => {
          const fixturePath = path.join(targetRoot, 'src', 'sample.ts');
          await fs.mkdir(path.dirname(fixturePath), { recursive: true });
          await fs.writeFile(fixturePath, 'export const value = 1;\n', 'utf8');
        }
      })
    } as unknown as RepositoryService, output, async (targetPath, fallback) => {
      if (targetPath === legacyRoot) {
        throw createErrnoError('EPERM', `EPERM: operation not permitted, rmdir '${legacyRoot}'`);
      }

      await fallback(targetPath);
    });
    const repo = createRepo(repoRoot);

    const revisionRoot = await service.materializeRevisionTree(repo, 'rev-1');

    assert.ok(revisionRoot.fsPath.includes(`${path.sep}.fukusa-shadow${path.sep}revisions${path.sep}rev-1`));
    await fs.access(path.join(revisionRoot.fsPath, 'src', 'sample.ts'));
    assert.strictEqual(warnStub.callCount, 1);

    await cleanupTempRepo(repoRoot);
  });

  test('restores readonly permissions after writing multiple raw files into the same revision root', async () => {
    const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'fukusa-shadow-'));
    const fsModule = require('fs/promises') as typeof import('fs/promises');
    const chmodSpy = sinon.spy(fsModule, 'chmod');
    const service = new ShadowWorkspaceService({} as RepositoryService, new OutputLogger('ShadowWorkspaceService Test'));
    const repo = createRepo(repoRoot);

    const firstRawUri = await service.writeRawFile(repo, 'rev-1', 'src/sample.ts', Buffer.from('const value = 1;\n', 'utf8'));
    const secondRawUri = await service.writeRawFile(repo, 'rev-1', 'src/other.ts', Buffer.from('const value = 2;\n', 'utf8'));
    const revisionRoot = path.join(repoRoot, '.fukusa-shadow', 'revisions', 'rev-1');

    assert.ok(firstRawUri.fsPath.includes(`${path.sep}.fukusa-shadow${path.sep}revisions${path.sep}rev-1`));
    assert.ok(secondRawUri.fsPath.includes(`${path.sep}.fukusa-shadow${path.sep}revisions${path.sep}rev-1`));
    assert.ok(chmodSpy.calledWith(revisionRoot, 0o555));

    await cleanupTempRepo(repoRoot);
  });
});

class TestShadowWorkspaceService extends ShadowWorkspaceService {
  public constructor(
    repositoryService: RepositoryService,
    output: OutputLogger,
    private readonly onRemoveDirectory?: (
      targetPath: string,
      fallback: (nextTargetPath: string) => Promise<void>
    ) => Promise<void>
  ) {
    super(repositoryService, output);
  }

  protected override async removeDirectory(targetPath: string): Promise<void> {
    if (!this.onRemoveDirectory) {
      await super.removeDirectory(targetPath);
      return;
    }

    await this.onRemoveDirectory(targetPath, async (nextTargetPath) => {
      await super.removeDirectory(nextTargetPath);
    });
  }
}

function createRepo(repoRoot: string): RepoContext {
  return {
    kind: 'git',
    repoRoot,
    repoId: 'repo123'
  };
}

function createErrnoError(code: string, message: string): NodeJS.ErrnoException {
  const error = new Error(message) as NodeJS.ErrnoException;
  error.code = code;
  return error;
}

async function cleanupTempRepo(rootPath: string): Promise<void> {
  await makeWritableRecursive(rootPath);
  await fs.rm(rootPath, { recursive: true, force: true });
}

async function makeWritableRecursive(rootPath: string): Promise<void> {
  const exists = await fs.stat(rootPath).then(() => true).catch(() => false);
  if (!exists) {
    return;
  }

  await fs.chmod(rootPath, 0o755).catch(() => undefined);
  const entries = await fs.readdir(rootPath, { withFileTypes: true });
  for (const entry of entries) {
    const targetPath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      await makeWritableRecursive(targetPath);
      continue;
    }

    await fs.chmod(targetPath, 0o666).catch(() => undefined);
  }
}
