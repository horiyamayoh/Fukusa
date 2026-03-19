import { NWayCompareSession, RawSnapshot, SessionRowProjectionState, SessionViewState } from '../adapters/common/types';
import {
  buildSessionViewport,
  getSessionActivePair,
  getSessionVisibleWindow,
  MAX_VISIBLE_REVISIONS
} from './sessionViewport';

export interface SessionCapabilityState {
  readonly canChangePairProjection: boolean;
  readonly canShiftWindow: boolean;
  readonly canShiftWindowLeft: boolean;
  readonly canShiftWindowRight: boolean;
  readonly hasActiveSnapshot: boolean;
  readonly hasActivePair: boolean;
  readonly activeRevisionLabel: string | undefined;
  readonly activePairLabel: string | undefined;
  readonly collapseUnchanged: boolean;
  readonly hasCollapsedGaps: boolean;
  readonly hasExpandedGaps: boolean;
  readonly visibleRevisionLabel: string;
}

export function canChangePairProjection(session: Pick<NWayCompareSession, 'rawSnapshots'>): boolean {
  return session.rawSnapshots.length > 2;
}

export function canShiftVisibleWindow(
  session: Pick<NWayCompareSession, 'surfaceMode' | 'rawSnapshots'>
): boolean {
  return session.surfaceMode === 'native' && session.rawSnapshots.length > MAX_VISIBLE_REVISIONS;
}

export function canShiftVisibleWindowLeft(
  session: Pick<NWayCompareSession, 'surfaceMode' | 'rawSnapshots'>,
  viewState: Pick<SessionViewState, 'pageStart'>
): boolean {
  return canShiftVisibleWindow(session) && viewState.pageStart > 0;
}

export function canShiftVisibleWindowRight(
  session: Pick<NWayCompareSession, 'surfaceMode' | 'rawSnapshots'>,
  viewState: Pick<SessionViewState, 'pageStart'>,
  pageSize = MAX_VISIBLE_REVISIONS
): boolean {
  if (!canShiftVisibleWindow(session)) {
    return false;
  }

  const maxStart = Math.max(0, session.rawSnapshots.length - Math.max(1, pageSize));
  return viewState.pageStart < maxStart;
}

export function getSessionCapabilityState(
  session: NWayCompareSession,
  viewState: SessionViewState,
  rowProjectionState: SessionRowProjectionState,
  pageSize = MAX_VISIBLE_REVISIONS
): SessionCapabilityState {
  const visibleWindow = getSessionVisibleWindow(session, viewState, pageSize);
  const activePair = getSessionActivePair(session, viewState, visibleWindow);
  const activeSnapshot = getActiveSnapshot(session, viewState);
  const canShiftWindow = canShiftVisibleWindow(session);
  const canShiftWindowLeft = canShiftVisibleWindowLeft(session, viewState);
  const canShiftWindowRight = canShiftVisibleWindowRight(session, viewState, pageSize);
  const hasCollapsedGaps = rowProjectionState.collapseUnchanged && buildSessionViewport(
    session,
    viewState,
    rowProjectionState,
    pageSize
  ).rowProjection.rows.some((row) => row.kind === 'gap');

  return {
    canChangePairProjection: canChangePairProjection(session),
    canShiftWindow,
    canShiftWindowLeft,
    canShiftWindowRight,
    hasActiveSnapshot: activeSnapshot !== undefined,
    hasActivePair: activePair !== undefined,
    activeRevisionLabel: activeSnapshot?.revisionLabel,
    activePairLabel: activePair?.label,
    collapseUnchanged: rowProjectionState.collapseUnchanged,
    hasCollapsedGaps,
    hasExpandedGaps: rowProjectionState.expandedGapKeys.length > 0,
    visibleRevisionLabel: getVisibleRevisionLabel(session, viewState, pageSize)
  };
}

function getActiveSnapshot(
  session: Pick<NWayCompareSession, 'rawSnapshots'>,
  viewState: Pick<SessionViewState, 'activeRevisionIndex'>
): RawSnapshot | undefined {
  if (session.rawSnapshots.length === 0) {
    return undefined;
  }

  const maxIndex = session.rawSnapshots.length - 1;
  const safeIndex = Math.max(0, Math.min(viewState.activeRevisionIndex, maxIndex));
  return session.rawSnapshots[safeIndex];
}

function getVisibleRevisionLabel(
  session: Pick<NWayCompareSession, 'surfaceMode' | 'rawSnapshots'>,
  viewState: SessionViewState,
  pageSize: number
): string {
  const visibleWindow = getSessionVisibleWindow(session, viewState, pageSize);
  if (visibleWindow.rawSnapshots.length === 0) {
    return '0 revisions';
  }

  if (session.surfaceMode === 'panel') {
    return `all ${session.rawSnapshots.length} revisions`;
  }

  return `window ${visibleWindow.startRevisionIndex + 1}-${visibleWindow.endRevisionIndex + 1}/${session.rawSnapshots.length}`;
}
