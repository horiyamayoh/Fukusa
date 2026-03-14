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
      const data = await fs.readFile(path.join(this.rootPath, entry.fileName));
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
    const fileName = path.join(metadata.namespace, `${stableHash(key, 20)}.${extension}`);
    const fullPath = path.join(this.rootPath, fileName);
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
      await fs.rm(path.join(this.rootPath, entry.fileName), { force: true });
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
    try {
      const contents = await fs.readFile(this.indexPath, 'utf8');
      const parsed = JSON.parse(contents) as Record<string, PersistedIndexEntry>;
      for (const [key, value] of Object.entries(parsed)) {
        this.index.set(key, value);
      }
    } catch {
      // Fresh cache directory.
    }

    this.initialized = true;
  }

  private async writeIndex(): Promise<void> {
    const serialized = Object.fromEntries(this.index.entries());
    await fs.writeFile(this.indexPath, JSON.stringify(serialized, undefined, 2), 'utf8');
  }
}
