import * as path from 'path';

import { BlameLineInfo, RevisionRef } from '../common/types';
import { execFileBuffered } from '../../util/process';

function readTag(xml: string, tag: string): string | undefined {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i'));
  return match?.[1];
}

export class SvnCli {
  public async isAvailable(): Promise<boolean> {
    try {
      await execFileBuffered('svn', ['--version', '--quiet']);
      return true;
    } catch {
      return false;
    }
  }

  public async resolveRepoRoot(targetPath: string): Promise<string | undefined> {
    try {
      const { stdout } = await execFileBuffered('svn', ['info', '--xml', targetPath]);
      return readTag(stdout.toString('utf8'), 'wcroot-abspath');
    } catch {
      return undefined;
    }
  }

  public async getHistory(repoRoot: string, relativePath: string, limit: number): Promise<RevisionRef[]> {
    const targetPath = path.join(repoRoot, relativePath);
    const { stdout } = await execFileBuffered('svn', ['log', '--xml', `-l${limit}`, targetPath]);
    const xml = stdout.toString('utf8');
    const entries = [...xml.matchAll(/<logentry\s+revision="(\d+)">([\s\S]*?)<\/logentry>/gi)];

    return entries.map((entry) => {
      const body = entry[2];
      const revision = entry[1];
      return {
        id: revision,
        shortLabel: revision,
        author: readTag(body, 'author'),
        message: readTag(body, 'msg'),
        timestamp: Date.parse(readTag(body, 'date') ?? '')
      };
    });
  }

  public async getSnapshot(repoRoot: string, relativePath: string, revision: string): Promise<Uint8Array> {
    const targetPath = path.join(repoRoot, relativePath);
    const { stdout } = await execFileBuffered('svn', ['cat', '-r', revision, `${targetPath}@${revision}`]);
    return new Uint8Array(stdout);
  }

  public async getBlame(repoRoot: string, relativePath: string, revision?: string): Promise<BlameLineInfo[]> {
    const effectiveRevision = revision ?? 'HEAD';
    const targetPath = path.join(repoRoot, relativePath);
    const args = ['blame', '--xml'];
    if (effectiveRevision !== 'HEAD') {
      args.push('-r', `1:${effectiveRevision}`);
    }
    args.push(`${targetPath}@${effectiveRevision}`);

    const { stdout } = await execFileBuffered('svn', args);
    const xml = stdout.toString('utf8');
    const entries = [...xml.matchAll(/<entry\s+line-number="(\d+)">([\s\S]*?)<\/entry>/gi)];

    return entries.map((entry) => {
      const lineNumber = Number(entry[1]);
      const body = entry[2];
      const commit = body.match(/<commit\s+revision="(\d+)">/i)?.[1];
      const author = readTag(body, 'author') ?? 'unknown';
      const date = readTag(body, 'date');
      return {
        lineNumber,
        revision: commit ?? effectiveRevision,
        author,
        summary: undefined,
        timestamp: date ? Date.parse(date) : undefined
      };
    });
  }

  public async getDiff(repoRoot: string, relativePath: string, leftRevision: string, rightRevision: string): Promise<string> {
    const targetPath = path.join(repoRoot, relativePath);
    const { stdout } = await execFileBuffered('svn', ['diff', '-r', `${leftRevision}:${rightRevision}`, targetPath]);
    return stdout.toString('utf8');
  }
}
