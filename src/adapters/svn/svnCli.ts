import * as path from 'path';
import { XMLParser } from 'fast-xml-parser';

import { BlameLineInfo, RevisionRef } from '../common/types';
import { execFileBuffered } from '../../util/process';

interface SvnInfoEntryNode {
  readonly ['wc-info']?: {
    readonly ['wcroot-abspath']?: unknown;
  };
}

interface SvnLogEntryNode {
  readonly revision?: string;
  readonly author?: unknown;
  readonly msg?: unknown;
  readonly date?: unknown;
}

interface SvnBlameCommitNode {
  readonly revision?: string;
  readonly author?: unknown;
  readonly date?: unknown;
}

interface SvnBlameEntryNode {
  readonly ['line-number']?: string;
  readonly commit?: SvnBlameCommitNode;
}

const svnRevisionPattern = /^\d+$/;
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  parseTagValue: false,
  trimValues: false
});

function asArray<T>(value: T | readonly T[] | undefined): readonly T[] {
  if (value === undefined) {
    return [];
  }

  return Array.isArray(value) ? value : [value as T];
}

function asString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return undefined;
}

function assertValidSvnRevision(revision: string, allowHead = false): void {
  if ((allowHead && revision === 'HEAD') || svnRevisionPattern.test(revision)) {
    return;
  }

  throw new Error(`Invalid SVN revision: ${revision}`);
}

function parseXml<T>(xml: string): T {
  return xmlParser.parse(xml) as T;
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
      const parsed = parseXml<{ readonly info?: { readonly entry?: SvnInfoEntryNode | readonly SvnInfoEntryNode[] } }>(
        stdout.toString('utf8')
      );
      const entry = asArray(parsed.info?.entry)[0];
      return asString(entry?.['wc-info']?.['wcroot-abspath']);
    } catch {
      return undefined;
    }
  }

  public async getHistory(repoRoot: string, relativePath: string, limit: number): Promise<RevisionRef[]> {
    const targetPath = path.join(repoRoot, relativePath);
    const { stdout } = await execFileBuffered('svn', ['log', '--xml', `-l${limit}`, targetPath]);
    const parsed = parseXml<{ readonly log?: { readonly logentry?: SvnLogEntryNode | readonly SvnLogEntryNode[] } }>(
      stdout.toString('utf8')
    );

    return asArray(parsed.log?.logentry).flatMap((entry) => {
      const revision = asString(entry.revision);
      if (!revision) {
        return [];
      }

      return {
        id: revision,
        shortLabel: revision,
        author: asString(entry.author),
        message: asString(entry.msg),
        timestamp: Date.parse(asString(entry.date) ?? '')
      };
    });
  }

  public async getSnapshot(repoRoot: string, relativePath: string, revision: string): Promise<Uint8Array> {
    assertValidSvnRevision(revision);
    const targetPath = path.join(repoRoot, relativePath);
    const { stdout } = await execFileBuffered('svn', ['cat', '-r', revision, `${targetPath}@${revision}`]);
    return new Uint8Array(stdout);
  }

  public async getBlame(repoRoot: string, relativePath: string, revision?: string): Promise<BlameLineInfo[]> {
    const effectiveRevision = revision ?? 'HEAD';
    assertValidSvnRevision(effectiveRevision, true);
    const targetPath = path.join(repoRoot, relativePath);
    const args = ['blame', '--xml'];
    if (effectiveRevision !== 'HEAD') {
      args.push('-r', `1:${effectiveRevision}`);
    }
    args.push(`${targetPath}@${effectiveRevision}`);

    const { stdout } = await execFileBuffered('svn', args);
    const parsed = parseXml<{ readonly blame?: { readonly target?: { readonly entry?: SvnBlameEntryNode | readonly SvnBlameEntryNode[] } } }>(
      stdout.toString('utf8')
    );
    const entries = asArray(parsed.blame?.target?.entry);

    return entries.flatMap((entry) => {
      const lineNumber = Number(asString(entry['line-number']) ?? '');
      if (!Number.isFinite(lineNumber)) {
        return [];
      }

      const author = asString(entry.commit?.author) ?? 'unknown';
      const date = asString(entry.commit?.date);
      return {
        lineNumber,
        revision: asString(entry.commit?.revision) ?? effectiveRevision,
        author,
        summary: undefined,
        timestamp: date ? Date.parse(date) : undefined
      };
    });
  }

  public async getDiff(repoRoot: string, relativePath: string, leftRevision: string, rightRevision: string): Promise<string> {
    assertValidSvnRevision(leftRevision);
    assertValidSvnRevision(rightRevision);
    const targetPath = path.join(repoRoot, relativePath);
    const { stdout } = await execFileBuffered('svn', ['diff', '-r', `${leftRevision}:${rightRevision}`, targetPath]);
    return stdout.toString('utf8');
  }
}
