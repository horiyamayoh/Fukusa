import * as path from 'path';

import { BlameLineInfo, RevisionRef } from '../common/types';
import { execFileBuffered } from '../../util/process';

function normalizeGitPath(relativePath: string): string {
  return relativePath.split(path.sep).join(path.posix.sep);
}

export class GitCli {
  public async isAvailable(): Promise<boolean> {
    try {
      await execFileBuffered('git', ['--version']);
      return true;
    } catch {
      return false;
    }
  }

  public async resolveRepoRoot(targetPath: string): Promise<string | undefined> {
    try {
      const { stdout } = await execFileBuffered('git', ['-C', path.dirname(targetPath), 'rev-parse', '--show-toplevel']);
      return stdout.toString('utf8').trim();
    } catch {
      return undefined;
    }
  }

  public async getHistory(repoRoot: string, relativePath: string, limit: number): Promise<RevisionRef[]> {
    const format = '%H%x1f%h%x1f%an%x1f%ae%x1f%ad%x1f%s';
    const args = [
      '-C',
      repoRoot,
      'log',
      '--follow',
      `-n${limit}`,
      '--date=iso-strict',
      `--format=${format}`,
      '--',
      normalizeGitPath(relativePath)
    ];
    const { stdout } = await execFileBuffered('git', args);
    const lines = stdout.toString('utf8').split(/\r?\n/).filter(Boolean);
    return lines.map((line) => {
      const [id, shortLabel, author, email, date, message] = line.split('\u001f');
      return {
        id,
        shortLabel,
        author,
        email,
        message,
        timestamp: Date.parse(date)
      };
    });
  }

  public async getSnapshot(repoRoot: string, relativePath: string, revision: string): Promise<Uint8Array> {
    const { stdout } = await execFileBuffered('git', [
      '-C',
      repoRoot,
      'show',
      `${revision}:${normalizeGitPath(relativePath)}`
    ]);
    return new Uint8Array(stdout);
  }

  public async getBlame(repoRoot: string, relativePath: string, revision?: string): Promise<BlameLineInfo[]> {
    const args = ['-C', repoRoot, 'blame', '--line-porcelain'];
    if (revision) {
      args.push(revision);
    }
    args.push('--', normalizeGitPath(relativePath));

    const { stdout } = await execFileBuffered('git', args);
    const lines = stdout.toString('utf8').split(/\r?\n/);
    const blame: BlameLineInfo[] = [];

    let currentRevision = '';
    let currentAuthor = '';
    let currentEmail = '';
    let currentSummary = '';
    let currentTimestamp = 0;

    for (const line of lines) {
      if (!line) {
        continue;
      }

      if (/^[0-9a-f]{40}\s+\d+\s+\d+\s+\d+$/.test(line)) {
        currentRevision = line.split(' ')[0];
        currentAuthor = '';
        currentEmail = '';
        currentSummary = '';
        currentTimestamp = 0;
        continue;
      }

      if (line.startsWith('author ')) {
        currentAuthor = line.slice('author '.length);
        continue;
      }

      if (line.startsWith('author-mail ')) {
        currentEmail = line.slice('author-mail '.length).replace(/^<|>$/g, '');
        continue;
      }

      if (line.startsWith('author-time ')) {
        currentTimestamp = Number(line.slice('author-time '.length)) * 1000;
        continue;
      }

      if (line.startsWith('summary ')) {
        currentSummary = line.slice('summary '.length);
        continue;
      }

      if (line.startsWith('\t')) {
        blame.push({
          lineNumber: blame.length + 1,
          revision: currentRevision,
          author: currentAuthor,
          email: currentEmail,
          summary: currentSummary,
          timestamp: currentTimestamp
        });
      }
    }

    return blame;
  }

  public async getDiff(repoRoot: string, relativePath: string, leftRevision: string, rightRevision: string): Promise<string> {
    const { stdout } = await execFileBuffered('git', [
      '-C',
      repoRoot,
      'diff',
      leftRevision,
      rightRevision,
      '--',
      normalizeGitPath(relativePath)
    ]);
    return stdout.toString('utf8');
  }
}
