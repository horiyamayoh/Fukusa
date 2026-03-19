import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

import { ComparePairProjection, CompareSourceDocument, CompareSurfaceMode, NWayCompareSession, ResolvedResource, RevisionRef } from '../adapters/common/types';
import { createShadowTreeCacheKey, createSnapshotCacheKey } from '../infrastructure/cache/cacheKeys';
import { UriFactory } from '../infrastructure/fs/uriFactory';
import { ShadowWorkspaceService } from '../infrastructure/shadow/shadowWorkspaceService';
import { OutputLogger } from '../util/output';
import { BlameService } from './blameService';
import { CacheService } from './cacheService';
import { normalizePairProjection } from './comparePairing';
import { RepositoryService } from './repositoryService';
import { SessionAlignmentService } from './sessionAlignmentService';
import { SessionService } from './sessionService';

export interface SessionBuildOptions {
  readonly pairProjection?: ComparePairProjection;
  readonly surfaceMode?: CompareSurfaceMode;
}

export class SessionBuilderService {
  public constructor(
    private readonly repositoryService: RepositoryService,
    private readonly cacheService: CacheService,
    private readonly blameService: BlameService,
    private readonly uriFactory: UriFactory,
    private readonly alignmentService: SessionAlignmentService,
    private readonly shadowWorkspaceService: ShadowWorkspaceService,
    private readonly sessionService: SessionService,
    private readonly output: OutputLogger
  ) {}

  public async createSession(
    resource: ResolvedResource,
    revisions: readonly RevisionRef[],
    options: SessionBuildOptions = {}
  ): Promise<NWayCompareSession> {
    const sessionId = uuidv4();
    const sources = await this.loadDocuments(resource, revisions);
    const alignment = this.alignmentService.buildState(sources);
    const pairProjection = normalizePairProjection(options.pairProjection, alignment.rawSnapshots.length);
    const surfaceMode = options.surfaceMode ?? 'native';

    const session: NWayCompareSession = {
      id: sessionId,
      uri: this.uriFactory.createSessionUri(sessionId, resource.relativePath),
      repo: resource.repo,
      originalUri: resource.originalUri,
      relativePath: resource.relativePath,
      revisions,
      createdAt: Date.now(),
      rowCount: alignment.rowCount,
      rawSnapshots: alignment.rawSnapshots,
      globalRows: alignment.globalRows,
      adjacentPairs: alignment.adjacentPairs,
      pairProjection,
      surfaceMode
    };

    this.output.info(`Built compare session ${session.id} for ${path.posix.basename(resource.relativePath)}.`);
    return this.sessionService.createBrowserSession(session);
  }

  private async loadDocuments(resource: ResolvedResource, revisions: readonly RevisionRef[]): Promise<CompareSourceDocument[]> {
    const adapter = this.repositoryService.getAdapter(resource.repo.kind);

    return Promise.all(revisions.map(async (revision, index) => {
      const relativePath = revision.relativePath ?? resource.relativePath;
      const snapshotUri = this.uriFactory.createSnapshotUri(resource.repo, relativePath, revision.id);
      const bytes = await this.cacheService.getOrLoadBytes(
        createSnapshotCacheKey(resource.repo, relativePath, revision.id),
        () => adapter.getSnapshot(resource.repo, relativePath, revision.id)
      );

      const rawUri = await this.shadowWorkspaceService.writeRawFile(
        resource.repo,
        revision.id,
        relativePath,
        bytes.value
      );

      void this.cacheService.getOrLoadJson(
        createShadowTreeCacheKey(resource.repo, revision.id),
        async () => {
          const root = await this.shadowWorkspaceService.materializeRevisionTree(resource.repo, revision.id);
          return { rootPath: root.fsPath };
        }
      ).catch((error) => {
        this.output.warn(`Background shadow materialization failed for ${revision.id}: ${String(error)}`);
      });

      const heatmap = await this.blameService.getHeatmap(snapshotUri);

      return {
        revisionIndex: index,
        revisionId: revision.id,
        revisionLabel: revision.shortLabel,
        relativePath,
        snapshotUri,
        rawUri,
        text: Buffer.from(bytes.value).toString('utf8'),
        blameLines: heatmap?.lines
      };
    }));
  }
}
