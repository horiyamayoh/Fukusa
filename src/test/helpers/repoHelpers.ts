import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';

export interface GitRepoFixture {
  readonly root: string;
  readonly filePath: string;
  readonly revisions: readonly string[];
}

export interface SvnRepoFixture {
  readonly root: string;
  readonly workingCopy: string;
  readonly filePath: string;
  readonly revisions: readonly string[];
}

export function commandExists(command: string): boolean {
  try {
    execFileSync(command, ['--version'], { stdio: 'ignore', windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

export async function createTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

export async function createGitRepoFixture(): Promise<GitRepoFixture> {
  const root = await createTempDir('multidiff-git-');
  const filePath = path.join(root, 'sample.ts');

  run('git', ['init'], root);
  run('git', ['config', 'user.email', 'test@example.com'], root);
  run('git', ['config', 'user.name', 'MultiDiff Test'], root);

  await fs.writeFile(filePath, 'export const value = 1;\n', 'utf8');
  run('git', ['add', 'sample.ts'], root);
  run('git', ['commit', '-m', 'first'], root);
  const revision1 = run('git', ['rev-parse', 'HEAD'], root).trim();

  await fs.writeFile(filePath, 'export const value = 2;\nexport const extra = true;\n', 'utf8');
  run('git', ['commit', '-am', 'second'], root);
  const revision2 = run('git', ['rev-parse', 'HEAD'], root).trim();

  return {
    root,
    filePath,
    revisions: [revision1, revision2]
  };
}

export async function createSvnRepoFixture(): Promise<SvnRepoFixture> {
  const root = await createTempDir('multidiff-svn-');
  const repositoryPath = path.join(root, 'repo');
  const workingCopy = path.join(root, 'wc');
  const filePath = path.join(workingCopy, 'sample.ts');

  run('svnadmin', ['create', repositoryPath], root);
  const repoUri = `file:///${repositoryPath.replace(/\\/g, '/')}`;
  run('svn', ['checkout', repoUri, workingCopy], root);

  await fs.writeFile(filePath, 'export const value = 1;\n', 'utf8');
  run('svn', ['add', filePath], workingCopy);
  run('svn', ['commit', '-m', 'first', workingCopy], workingCopy);

  await fs.writeFile(filePath, 'export const value = 2;\nexport const extra = true;\n', 'utf8');
  run('svn', ['commit', '-m', 'second', workingCopy], workingCopy);

  return {
    root,
    workingCopy,
    filePath,
    revisions: ['1', '2']
  };
}

function run(command: string, args: readonly string[], cwd: string): string {
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    windowsHide: true
  });
}
