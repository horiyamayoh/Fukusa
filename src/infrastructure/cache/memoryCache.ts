import { LRUCache } from 'lru-cache';

import { CacheEntryMetadata, CacheValueKind } from '../../adapters/common/types';

export interface MemoryCacheEntry {
  readonly kind: CacheValueKind;
  readonly value: Uint8Array | unknown;
  readonly byteLength: number;
  readonly metadata: CacheEntryMetadata;
}

function estimateSize(value: Uint8Array | unknown): number {
  if (value instanceof Uint8Array) {
    return value.byteLength;
  }

  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

export class MemoryCache {
  private readonly cache: LRUCache<string, MemoryCacheEntry>;

  public constructor(maxSizeBytes: number) {
    this.cache = new LRUCache<string, MemoryCacheEntry>({
      maxSize: maxSizeBytes,
      sizeCalculation: (entry) => entry.byteLength
    });
  }

  public get(key: string): MemoryCacheEntry | undefined {
    return this.cache.get(key);
  }

  public set(key: string, kind: CacheValueKind, value: Uint8Array | unknown, metadata: CacheEntryMetadata): void {
    const storedValue = value instanceof Uint8Array ? new Uint8Array(value) : value;
    this.cache.set(key, {
      kind,
      value: storedValue,
      byteLength: estimateSize(storedValue),
      metadata
    });
  }

  public deleteWhere(predicate: (entry: MemoryCacheEntry) => boolean): void {
    for (const [key, entry] of this.cache.entries()) {
      if (predicate(entry)) {
        this.cache.delete(key);
      }
    }
  }

  public clear(): void {
    this.cache.clear();
  }

  public entries(): readonly MemoryCacheEntry[] {
    return [...this.cache.values()];
  }
}
