import { BlameDecorationController } from '../presentation/decorations/blameDecorationController';
import { CacheService } from '../application/cacheService';
import { LanguageFeatureCompatibilityService } from '../application/languageFeatureCompatibilityService';
import { RepositoryService } from '../application/repositoryService';
import { RevisionPickerService } from '../application/revisionPickerService';
import { SessionBuilderService } from '../application/sessionBuilderService';
import { SessionService } from '../application/sessionService';
import { UriFactory } from '../infrastructure/fs/uriFactory';
import { CompareSurfaceCoordinator } from '../presentation/compare/compareSurfaceCoordinator';
import { OutputLogger } from '../util/output';

export interface CommandContext {
  readonly output: OutputLogger;
  readonly repositoryService: RepositoryService;
  readonly revisionPickerService: RevisionPickerService;
  readonly uriFactory: UriFactory;
  readonly compatibilityService: LanguageFeatureCompatibilityService;
  readonly sessionBuilderService: SessionBuilderService;
  readonly sessionService: SessionService;
  readonly compareSessionController: CompareSurfaceCoordinator;
  readonly cacheService: CacheService;
  readonly blameDecorationController: BlameDecorationController;
}
