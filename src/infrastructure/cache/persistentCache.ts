import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';

import { CacheEntryMetadata, CacheOverviewItem, CacheValueKind } from '../../adapters/common/types';
import { stableHash } from '../../util/hash';

interface PersistedIndexEntry {
  readonly kind: CacheValueKind;
  readonly metadata: CacheEntryMetadata;
  readonly fileName: string;
}

export interface PersistentCacheEntry {
  readonly kind: CacheValueKind;
  readonly value: Uint8Array | unknown;
  readonly metadata: CacheEntryMetadata;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidMetadata(value: unknown): value is CacheEntryMetadata {
  return isRecord(value)
    && typeof value.key === 'string'
    && typeof value.namespace === 'string'
    && typeof value.repoId === 'string'
    && typeof value.relativePath === 'string'
    && typeof value.size === 'number'
    && Number.isFinite(value.size)
    && value.size >= 0
    && typeof value.updatedAt === 'number'
    && Number.isFinite(value.updatedAt);
}

function normalizeCacheFileName(fileName: string): string | undefined {
  const normalized = fileName.replace(/\\/g, '/');
  if (!normalized || path.posix.isAbsolute(normalized) || normalized.split('/').some((segment) => segment === '..')) {
    return undefined;
  }

  const cleaned = path.posix.normalize(normalized);
  if (cleaned === '.' || cleaned.startsWith('../')) {
    return undefined;
  }

  return cleaned;
}

export class PersistentCache {
  private initialized = false;
  private readonly rootPath: string;
  private readonly indexPath: string;
  private readonly index = new Map<string, PersistedIndexEntry>();

  public constructor(storageUri: vscode.Uri) {
    this.rootPath = path.join(storageUri.fsPath, 'cache');
    this.indexPath = path.join(this.rootPath, 'index.json');
  }

  public async get(key: string): Promise<PersistentCacheEntry | undefined> {
    await this.ensureInitialized();
    const entry = this.index.get(key);
    if (!entry) {
      return undefined;
    }

    try {
      const entryPath = this.resolveEntryPath(entry.fileName);
      if (!entryPath) {
        this.index.delete(key);
        await this.writeIndex();
        return undefined;
      }

      const data = await fs.readFile(entryPath);
      return {
        kind: entry.kind,
        value: entry.kind === 'binary' ? new Uint8Array(data) : JSON.parse(data.toString('utf8')),
        metadata: entry.metadata
      };
    } catch {
      this.index.delete(key);
      await this.writeIndex();
      return undefined;
    }
  }

  public async set(
    key: string,
    kind: CacheValueKind,
    value: Uint8Array | unknown,
    metadata: CacheEntryMetadata
  ): Promise<void> {
    await this.ensureInitialized();

    const extension = kind === 'binary' ? 'bin' : 'json';
    const fileName = `${metadata.namespace}/${stableHash(key, 20)}.${extension}`;
    const fullPath = this.resolveEntryPath(fileName);
    if (!fullPath) {
      throw new Error(`Failed to resolve cache path for ${fileName}.`);
    }

    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    const contents = kind === 'binary'
      ? Buffer.from(value as Uint8Array)
      : Buffer.from(JSON.stringify(value), 'utf8');
    await fs.writeFile(fullPath, contents);

    this.index.set(key, {
      kind,
      metadata,
      fileName
    });
    await this.writeIndex();
  }

  public async delete(key: string): Promise<void> {
    await this.ensureInitialized();
    const entry = this.index.get(key);
    if (!entry) {
      return;
    }

    this.index.delete(key);
    const entryPath = this.resolveEntryPath(entry.fileName);
    if (entryPath) {
      await fs.rm(entryPath, { force: true });
    }

    await this.writeIndex();
  }

  public async deleteWhere(predicate: (metadata: CacheEntryMetadata) => boolean): Promise<void> {
    await this.ensureInitialized();
    const keysToDelete = [...this.index.entries()]
      .filter(([, entry]) => predicate(entry.metadata))
      .map(([key]) => key);

    await Promise.all(keysToDelete.map(async (key) => {
      const entry = this.index.get(key);
      if (!entry) {
        return;
      }

      this.index.delete(key);
      const entryPath = this.resolveEntryPath(entry.fileName);
      if (entryPath) {
        await fs.rm(entryPath, { force: true });
      }
    }));

    await this.writeIndex();
  }

  public async clear(): Promise<void> {
    await this.ensureInitialized();
    this.index.clear();
    await fs.rm(this.rootPath, { recursive: true, force: true });
    this.initialized = false;
    await this.ensureInitialized();
    await this.writeIndex();
  }

  public async getOverview(): Promise<CacheOverviewItem[]> {
    await this.ensureInitialized();
    const grouped = new Map<string, { size: number; entryCount: number; namespaces: Map<string, number> }>();

    for (const entry of this.index.values()) {
      const group = grouped.get(entry.metadata.repoId) ?? {
        size: 0,
        entryCount: 0,
        namespaces: new Map<string, number>()
      };
      group.size += entry.metadata.size;
      group.entryCount += 1;
      group.namespaces.set(entry.metadata.namespace, (group.namespaces.get(entry.metadata.namespace) ?? 0) + 1);
      grouped.set(entry.metadata.repoId, group);
    }

    return [...grouped.entries()].map(([repoId, group]) => ({
      repoId,
      size: group.size,
      entryCount: group.entryCount,
      namespaces: group.namespaces
    }));
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await fs.mkdir(this.rootPath, { recursive: true });
    let shouldRewriteIndex = false;
    try {
      const contents = await fs.readFile(this.indexPath, 'utf8');
      const { entries, hasInvalidEntries } = this.parseIndex(contents);
      shouldRewriteIndex = hasInvalidEntries;
      for (const [key, value] of entries) {
        this.index.set(key, value);
      }
    } catch (error) {
      const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : undefined;
      shouldRewriteIndex = code !== 'ENOENT';
    }

    this.initialized = true;
    if (shouldRewriteIndex) {
      await this.writeIndex();
    }
  }

  private async writeIndex(): Promise<void> {
    const serialized = Object.fromEntries(this.index.entries());
    await fs.writeFile(this.indexPath, JSON.stringify(serialized, undefined, 2), 'utf8');
  }

  private parseIndex(contents: string): { entries: Array<[string, PersistedIndexEntry]>; hasInvalidEntries: boolean } {
    const parsed = JSON.parse(contents) as unknown;
    if (!isRecord(parsed)) {
      throw new Error('Invalid cache index format.');
    }

    const entries: Array<[string, PersistedIndexEntry]> = [];
    let hasInvalidEntries = false;

    for (const [key, value] of Object.entries(parsed)) {
      const entry = this.parseIndexEntry(key, value);
      if (!entry) {
        hasInvalidEntries = true;
        continue;
      }

      entries.push([key, entry]);
    }

    return { entries, hasInvalidEntries };
  }

  private parseIndexEntry(key: string, value: unknown): PersistedIndexEntry | undefined {
    if (!isRecord(value)) {
      return undefined;
    }

    if (value.kind !== 'binary' && value.kind !== 'json') {
      return undefined;
    }

    if (!isValidMetadata(value.metadata) || value.metadata.key !== key) {
      return undefined;
    }

    if (typeof value.fileName !== 'string') {
      return undefined;
    }

    const fileName = normalizeCacheFileName(value.fileName);
    if (!fileName) {
      return undefined;
    }

    return {
      kind: value.kind,
      metadata: value.metadata,
      fileName
    };
  }

  private resolveEntryPath(fileName: string): string | undefined {
    const normalized = normalizeCacheFileName(fileName);
    if (!normalized) {
      return undefined;
    }

    return path.join(this.rootPath, ...normalized.split('/'));
  }
}
