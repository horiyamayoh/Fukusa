import {
  ComparePairOverlay,
  NWayCompareSession,
  SessionProjectedLineMap,
  SessionViewState,
  VisibleRevisionWindow
} from '../adapters/common/types';
import { CompareRowProjectionOptions, CompareRowProjectionResult } from './compareRowProjection';
import { deriveActivePairKey, getPairOverlay, getVisiblePairKeys } from './comparePairing';
import { buildSessionRowProjection, createProjectedLineMap } from './sessionRowProjection';

export const MAX_VISIBLE_REVISIONS = 9;

export interface SessionViewportState {
  readonly visibleWindow: VisibleRevisionWindow;
  readonly activePair: ComparePairOverlay | undefined;
  readonly visiblePairs: readonly ComparePairOverlay[];
  readonly rowProjection: CompareRowProjectionResult;
  readonly visibleDataRowNumbers: readonly number[];
  readonly documentGlobalRowNumbers: readonly number[];
  readonly documentLineMap: SessionProjectedLineMap;
}

export function getSessionVisibleWindow(
  session: Pick<NWayCompareSession, 'surfaceMode' | 'rawSnapshots'>,
  viewState: Pick<SessionViewState, 'pageStart'>,
  pageSize = MAX_VISIBLE_REVISIONS
): VisibleRevisionWindow {
  if (session.surfaceMode === 'panel') {
    return {
      startRevisionIndex: 0,
      endRevisionIndex: session.rawSnapshots.length - 1,
      rawSnapshots: session.rawSnapshots
    };
  }

  const safePageSize = Math.max(1, pageSize);
  const maxStart = Math.max(0, session.rawSnapshots.length - safePageSize);
  const startRevisionIndex = Math.max(0, Math.min(viewState.pageStart, maxStart));
  const rawSnapshots = session.rawSnapshots.slice(startRevisionIndex, startRevisionIndex + safePageSize);
  const endRevisionIndex = rawSnapshots.length === 0
    ? startRevisionIndex - 1
    : startRevisionIndex + rawSnapshots.length - 1;

  return {
    startRevisionIndex,
    endRevisionIndex,
    rawSnapshots
  };
}

export function getSessionActivePair(
  session: Pick<NWayCompareSession, 'pairProjection' | 'rawSnapshots' | 'adjacentPairs' | 'globalRows' | 'surfaceMode'>,
  viewState: Pick<SessionViewState, 'activePairKey' | 'activeRevisionIndex' | 'pageStart'>,
  visibleWindow = getSessionVisibleWindow(session, viewState)
): ComparePairOverlay | undefined {
  const selectedKey = viewState.activePairKey;
  if (selectedKey) {
    const selected = isPairVisible(session, selectedKey, visibleWindow)
      ? getPairOverlay(session, selectedKey)
      : undefined;
    if (selected) {
      return selected;
    }
  }

  const derivedPairKey = deriveActivePairKey(session, viewState.activeRevisionIndex, visibleWindow);
  return derivedPairKey ? getPairOverlay(session, derivedPairKey) : undefined;
}

export function buildSessionViewport(
  session: NWayCompareSession,
  viewState: SessionViewState,
  rowProjectionOptions: CompareRowProjectionOptions = { collapseUnchanged: false },
  pageSize = MAX_VISIBLE_REVISIONS
): SessionViewportState {
  const visibleWindow = getSessionVisibleWindow(session, viewState, pageSize);
  const activePair = getSessionActivePair(session, viewState, visibleWindow);
  const sessionRowProjection = buildSessionRowProjection(session, visibleWindow, rowProjectionOptions);
  const documentGlobalRowNumbers = sessionRowProjection.visibleDataRowNumbers.length > 0 || session.rowCount === 0
    ? sessionRowProjection.visibleDataRowNumbers
    : Array.from({ length: session.rowCount }, (_, index) => index + 1);
  const documentLineMap = sessionRowProjection.visibleDataRowNumbers.length > 0 || session.rowCount === 0
    ? sessionRowProjection.projectedLineMap
    : createProjectedLineMap(documentGlobalRowNumbers);

  return {
    visibleWindow,
    activePair,
    visiblePairs: sessionRowProjection.visiblePairs,
    rowProjection: sessionRowProjection.projection,
    visibleDataRowNumbers: sessionRowProjection.visibleDataRowNumbers,
    documentGlobalRowNumbers,
    documentLineMap
  };
}

export function createInitialSessionViewState(
  session: Pick<NWayCompareSession, 'pairProjection' | 'rawSnapshots' | 'surfaceMode'>
): SessionViewState {
  const activeRevisionIndex = 0;
  const pageStart = 0;
  const activePairKey = deriveActivePairKey(
    session,
    activeRevisionIndex,
    getSessionVisibleWindow(session, { pageStart })
  );

  return {
    activeRevisionIndex,
    activePairKey,
    pageStart
  };
}

function isPairVisible(
  session: Pick<NWayCompareSession, 'pairProjection'>,
  pairKey: string,
  visibleWindow: VisibleRevisionWindow
): boolean {
  return getVisiblePairKeys(session.pairProjection, visibleWindow).includes(pairKey);
}
