import { BlameDecorationController } from '../presentation/decorations/blameDecorationController';
import { NativeDiffSessionController } from '../presentation/native/nativeDiffSessionController';
import { CacheService } from '../application/cacheService';
import { LanguageFeatureCompatibilityService } from '../application/languageFeatureCompatibilityService';
import { RepositoryService } from '../application/repositoryService';
import { RevisionPickerService } from '../application/revisionPickerService';
import { SessionService } from '../application/sessionService';
import { UriFactory } from '../infrastructure/fs/uriFactory';
import { OutputLogger } from '../util/output';

export interface CommandContext {
  readonly output: OutputLogger;
  readonly repositoryService: RepositoryService;
  readonly revisionPickerService: RevisionPickerService;
  readonly uriFactory: UriFactory;
  readonly compatibilityService: LanguageFeatureCompatibilityService;
  readonly sessionService: SessionService;
  readonly nativeDiffSessionController: NativeDiffSessionController;
  readonly cacheService: CacheService;
  readonly blameDecorationController: BlameDecorationController;
}
