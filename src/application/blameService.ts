import * as vscode from 'vscode';

import { BlameLineInfo, ResolvedResource } from '../adapters/common/types';
import { createBlameCacheKey } from '../infrastructure/cache/cacheKeys';
import { CacheService } from './cacheService';
import { RepositoryService } from './repositoryService';

export interface BlameHeatmapLine extends BlameLineInfo {
  readonly ageBucket: number;
}

export interface BlameHeatmap {
  readonly resource: ResolvedResource;
  readonly lines: readonly BlameHeatmapLine[];
}

export const WORKTREE_BLAME_CACHE_TTL_MS = 60 * 1000;

export function bucketizeAge(timestamp: number | undefined, now = Date.now()): number {
  if (!timestamp) {
    return 4;
  }

  const ageDays = (now - timestamp) / (1000 * 60 * 60 * 24);
  if (ageDays <= 30) {
    return 0;
  }
  if (ageDays <= 180) {
    return 1;
  }
  if (ageDays <= 365) {
    return 2;
  }
  if (ageDays <= 730) {
    return 3;
  }
  return 4;
}

export class BlameService {
  public constructor(
    private readonly repositoryService: RepositoryService,
    private readonly cacheService: CacheService
  ) {}

  public async getHeatmap(uri: vscode.Uri): Promise<BlameHeatmap | undefined> {
    const resource = await this.repositoryService.resolveResource(uri);
    if (!resource) {
      return undefined;
    }

    const adapter = this.repositoryService.getAdapter(resource.repo.kind);
    const result = await this.cacheService.getOrLoadJson(
      createBlameCacheKey(resource.repo, resource.relativePath, resource.revision),
      () => adapter.getBlame(resource.repo, resource.relativePath, resource.revision),
      resource.revision ? undefined : { maxAgeMs: WORKTREE_BLAME_CACHE_TTL_MS }
    );

    const lines = result.value.map((line) => ({
      ...line,
      ageBucket: bucketizeAge(line.timestamp)
    }));

    return {
      resource,
      lines
    };
  }
}
