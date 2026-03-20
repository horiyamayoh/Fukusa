import {
  ComparePairOverlay,
  NWayCompareSession,
  SessionProjectedLineMap,
  SessionViewState,
  VisibleRevisionWindow
} from '../adapters/common/types';
import { CompareRowProjectionOptions, CompareRowProjectionResult } from './compareRowProjection';
import { deriveActivePairKey, getPairOverlay, getVisiblePairKeys, parsePairKey } from './comparePairing';
import { buildSessionRowProjection } from './sessionRowProjection';

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
  const documentGlobalRowNumbers = sessionRowProjection.visibleDataRowNumbers;
  const documentLineMap = sessionRowProjection.projectedLineMap;

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

export function deriveSessionSelectionViewState(
  session: Pick<NWayCompareSession, 'pairProjection' | 'rawSnapshots' | 'surfaceMode'>,
  selection: Pick<SessionViewState, 'activeRevisionIndex' | 'activePairKey' | 'pageStart'>,
  pageSize = MAX_VISIBLE_REVISIONS
): SessionViewState {
  const maxRevisionIndex = Math.max(0, session.rawSnapshots.length - 1);
  const activeRevisionIndex = Math.max(0, Math.min(selection.activeRevisionIndex, maxRevisionIndex));
  const pageStart = deriveSessionPageStart(session, {
    activeRevisionIndex,
    activePairKey: selection.activePairKey,
    pageStart: selection.pageStart
  }, pageSize);
  const visibleWindow = getSessionVisibleWindow(session, { pageStart }, pageSize);
  const visiblePairKeys = getVisiblePairKeys(session.pairProjection, visibleWindow);
  const activePairKey = selection.activePairKey && visiblePairKeys.includes(selection.activePairKey)
    ? selection.activePairKey
    : deriveActivePairKey(session, activeRevisionIndex, visibleWindow);

  return {
    activeRevisionIndex,
    activePairKey,
    pageStart
  };
}

export function createInitialSessionViewState(
  session: Pick<NWayCompareSession, 'pairProjection' | 'rawSnapshots' | 'surfaceMode'>
): SessionViewState {
  return deriveSessionSelectionViewState(session, {
    activeRevisionIndex: 0,
    activePairKey: undefined,
    pageStart: 0
  });
}

function isPairVisible(
  session: Pick<NWayCompareSession, 'pairProjection'>,
  pairKey: string,
  visibleWindow: VisibleRevisionWindow
): boolean {
  return getVisiblePairKeys(session.pairProjection, visibleWindow).includes(pairKey);
}

function deriveSessionPageStart(
  session: Pick<NWayCompareSession, 'rawSnapshots' | 'surfaceMode'>,
  selection: Pick<SessionViewState, 'activeRevisionIndex' | 'activePairKey' | 'pageStart'>,
  pageSize: number
): number {
  const safePageSize = Math.max(1, pageSize);
  const maxStart = Math.max(0, session.rawSnapshots.length - safePageSize);
  const currentPageStart = clamp(selection.pageStart, 0, maxStart);
  if (session.surfaceMode === 'panel') {
    return currentPageStart;
  }

  const pairRange = getVisiblePairPageRange(selection.activePairKey, safePageSize, maxStart);
  if (pairRange) {
    return clamp(currentPageStart, pairRange.start, pairRange.end);
  }

  const revisionRange = getVisibleRevisionPageRange(selection.activeRevisionIndex, safePageSize, maxStart);
  return clamp(currentPageStart, revisionRange.start, revisionRange.end);
}

function getVisiblePairPageRange(
  activePairKey: string | undefined,
  pageSize: number,
  maxStart: number
): { readonly start: number; readonly end: number } | undefined {
  if (!activePairKey) {
    return undefined;
  }

  const parsed = parsePairKey(activePairKey);
  if (!parsed) {
    return undefined;
  }

  const minimumStart = Math.max(0, parsed.rightRevisionIndex - pageSize + 1);
  const maximumStart = Math.min(parsed.leftRevisionIndex, maxStart);
  if (minimumStart > maximumStart) {
    return undefined;
  }

  return {
    start: minimumStart,
    end: maximumStart
  };
}

function getVisibleRevisionPageRange(
  activeRevisionIndex: number,
  pageSize: number,
  maxStart: number
): { readonly start: number; readonly end: number } {
  return {
    start: Math.max(0, activeRevisionIndex - pageSize + 1),
    end: Math.min(activeRevisionIndex, maxStart)
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(value, maximum));
}
