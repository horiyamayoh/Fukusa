import * as vscode from 'vscode';

import { CacheEntryMetadata, CacheOverviewItem } from '../adapters/common/types';
import { OutputLogger } from '../util/output';
import { CacheKeyDescriptor } from '../infrastructure/cache/cacheKeys';
import { MemoryCache } from '../infrastructure/cache/memoryCache';
import { PersistentCache } from '../infrastructure/cache/persistentCache';

type CacheSource = 'memory' | 'persistent' | 'loader';

interface CacheResult<T> {
  readonly value: T;
  readonly source: CacheSource;
}

interface CacheLoadOptions {
  readonly maxAgeMs?: number;
}

export class CacheService {
  private readonly onDidChangeCacheEmitter = new vscode.EventEmitter<void>();

  public readonly onDidChangeCache = this.onDidChangeCacheEmitter.event;

  public constructor(
    private readonly memoryCache: MemoryCache,
    private readonly persistentCache: PersistentCache,
    private readonly output: OutputLogger
  ) {}

  public async getOrLoadBytes(
    descriptor: CacheKeyDescriptor,
    loader: () => Promise<Uint8Array>,
    options: CacheLoadOptions = {}
  ): Promise<CacheResult<Uint8Array>> {
    return this.getOrLoad(descriptor, 'binary', loader, options);
  }

  public async getOrLoadJson<T>(
    descriptor: CacheKeyDescriptor,
    loader: () => Promise<T>,
    options: CacheLoadOptions = {}
  ): Promise<CacheResult<T>> {
    return this.getOrLoad(descriptor, 'json', loader, options);
  }

  public async clearRepo(repoId: string): Promise<void> {
    this.memoryCache.deleteWhere((entry) => entry.metadata.repoId === repoId);
    await this.persistentCache.deleteWhere((entry) => entry.repoId === repoId);
    this.onDidChangeCacheEmitter.fire();
  }

  public async clearFile(repoId: string, relativePath: string): Promise<void> {
    this.memoryCache.deleteWhere((entry) => entry.metadata.repoId === repoId && entry.metadata.relativePath === relativePath);
    await this.persistentCache.deleteWhere((entry) => entry.repoId === repoId && entry.relativePath === relativePath);
    this.onDidChangeCacheEmitter.fire();
  }

  public async clearAll(): Promise<void> {
    this.memoryCache.clear();
    await this.persistentCache.clear();
    this.onDidChangeCacheEmitter.fire();
  }

  public async getOverview(): Promise<CacheOverviewItem[]> {
    return this.persistentCache.getOverview();
  }

  private async getOrLoad<T>(
    descriptor: CacheKeyDescriptor,
    kind: 'binary' | 'json',
    loader: () => Promise<T>,
    options: CacheLoadOptions
  ): Promise<CacheResult<T>> {
    const memory = this.memoryCache.get(descriptor.key);
    if (memory) {
      if (this.isExpired(memory.metadata, options.maxAgeMs)) {
        this.output.info(`cache expired (memory): ${descriptor.key}`);
        this.memoryCache.delete(descriptor.key);
      } else {
        this.output.info(`cache hit (memory): ${descriptor.key}`);
        return {
          value: (memory.value instanceof Uint8Array ? new Uint8Array(memory.value) : memory.value) as T,
          source: 'memory'
        };
      }
    }

    const persistent = await this.persistentCache.get(descriptor.key);
    if (persistent) {
      if (this.isExpired(persistent.metadata, options.maxAgeMs)) {
        this.output.info(`cache expired (persistent): ${descriptor.key}`);
        await this.persistentCache.delete(descriptor.key);
        this.onDidChangeCacheEmitter.fire();
      } else {
        this.output.info(`cache hit (persistent): ${descriptor.key}`);
        this.memoryCache.set(descriptor.key, kind, persistent.value, persistent.metadata);
        return {
          value: (persistent.value instanceof Uint8Array ? new Uint8Array(persistent.value) : persistent.value) as T,
          source: 'persistent'
        };
      }
    }

    this.output.info(`cache miss: ${descriptor.key}`);
    const value = await loader();
    const metadata: CacheEntryMetadata = {
      key: descriptor.key,
      namespace: descriptor.namespace,
      repoId: descriptor.repoId,
      relativePath: descriptor.relativePath,
      size: value instanceof Uint8Array ? value.byteLength : Buffer.byteLength(JSON.stringify(value), 'utf8'),
      updatedAt: Date.now()
    };
    this.memoryCache.set(descriptor.key, kind, value, metadata);
    await this.persistentCache.set(descriptor.key, kind, value, metadata);
    this.onDidChangeCacheEmitter.fire();
    return {
      value,
      source: 'loader'
    };
  }

  private isExpired(metadata: CacheEntryMetadata, maxAgeMs: number | undefined): boolean {
    return typeof maxAgeMs === 'number' && Date.now() - metadata.updatedAt > maxAgeMs;
  }
}
