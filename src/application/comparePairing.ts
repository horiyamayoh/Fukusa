import {
  ComparePairOverlay,
  ComparePairProjection,
  ComparePairProjectionMode,
  NWayCompareSession,
  VisibleRevisionWindow
} from '../adapters/common/types';

const pairOverlayCache = new WeakMap<object, Map<string, ComparePairOverlay>>();

export function buildPairKey(leftRevisionIndex: number, rightRevisionIndex: number): string {
  return `${leftRevisionIndex}:${rightRevisionIndex}`;
}

export function createPresetPairProjection(mode: Exclude<ComparePairProjectionMode, 'custom'>): ComparePairProjection {
  return { mode };
}

export function normalizePairProjection(
  pairProjection: ComparePairProjection | undefined,
  revisionCount: number
): ComparePairProjection {
  const mode = pairProjection?.mode ?? 'adjacent';
  if (mode !== 'custom') {
    return { mode };
  }

  const pairKeys = (pairProjection?.pairKeys ?? []).filter((key, index, keys) => {
    if (keys.indexOf(key) !== index) {
      return false;
    }

    const parsed = parsePairKey(key);
    return !!parsed && parsed.rightRevisionIndex < revisionCount;
  });

  return pairKeys.length > 0
    ? { mode: 'custom', pairKeys }
    : { mode: 'adjacent' };
}

export function getPairProjectionLabel(pairProjection: ComparePairProjection): string {
  if (pairProjection.mode !== 'custom') {
    return pairProjection.mode;
  }

  return `custom (${pairProjection.pairKeys?.length ?? 0} pairs)`;
}

export function parsePairKey(key: string): { readonly leftRevisionIndex: number; readonly rightRevisionIndex: number } | undefined {
  const [leftText, rightText] = key.split(':', 2);
  const leftRevisionIndex = Number(leftText);
  const rightRevisionIndex = Number(rightText);

  if (
    !Number.isInteger(leftRevisionIndex)
    || !Number.isInteger(rightRevisionIndex)
    || leftRevisionIndex < 0
    || rightRevisionIndex <= leftRevisionIndex
  ) {
    return undefined;
  }

  return {
    leftRevisionIndex,
    rightRevisionIndex
  };
}

export function deriveActivePairKey(
  session: Pick<NWayCompareSession, 'pairProjection' | 'rawSnapshots'>,
  activeRevisionIndex: number,
  visibleWindow: VisibleRevisionWindow
): string | undefined {
  const visiblePairKeys = getVisiblePairKeys(session.pairProjection, visibleWindow);
  if (visiblePairKeys.length === 0) {
    return undefined;
  }

  if (session.pairProjection.mode === 'base') {
    const baseRevisionIndex = visibleWindow.startRevisionIndex;
    if (activeRevisionIndex <= baseRevisionIndex || activeRevisionIndex > visibleWindow.endRevisionIndex) {
      return visiblePairKeys[0];
    }

    return buildPairKey(baseRevisionIndex, activeRevisionIndex);
  }

  if (session.pairProjection.mode === 'adjacent') {
    const rightPairKey = buildPairKey(activeRevisionIndex, activeRevisionIndex + 1);
    if (activeRevisionIndex < visibleWindow.endRevisionIndex && visiblePairKeys.includes(rightPairKey)) {
      return rightPairKey;
    }

    const leftPairKey = buildPairKey(activeRevisionIndex - 1, activeRevisionIndex);
    if (activeRevisionIndex > visibleWindow.startRevisionIndex && visiblePairKeys.includes(leftPairKey)) {
      return leftPairKey;
    }

    return visiblePairKeys[0];
  }

  return selectFocusedPairKey(visiblePairKeys, activeRevisionIndex) ?? visiblePairKeys[0];
}

export function getVisiblePairKeys(
  pairProjection: ComparePairProjection,
  visibleWindow: Pick<VisibleRevisionWindow, 'startRevisionIndex' | 'endRevisionIndex'>
): readonly string[] {
  if (visibleWindow.endRevisionIndex <= visibleWindow.startRevisionIndex) {
    return [];
  }

  switch (pairProjection.mode) {
    case 'base': {
      const baseRevisionIndex = visibleWindow.startRevisionIndex;
      return Array.from(
        { length: visibleWindow.endRevisionIndex - baseRevisionIndex },
        (_, index) => buildPairKey(baseRevisionIndex, baseRevisionIndex + index + 1)
      );
    }
    case 'all': {
      const pairs: string[] = [];
      for (let leftRevisionIndex = visibleWindow.startRevisionIndex; leftRevisionIndex < visibleWindow.endRevisionIndex; leftRevisionIndex += 1) {
        for (let rightRevisionIndex = leftRevisionIndex + 1; rightRevisionIndex <= visibleWindow.endRevisionIndex; rightRevisionIndex += 1) {
          pairs.push(buildPairKey(leftRevisionIndex, rightRevisionIndex));
        }
      }
      return pairs;
    }
    case 'custom':
      return (pairProjection.pairKeys ?? []).filter((key) => {
        const parsed = parsePairKey(key);
        return !!parsed
          && parsed.leftRevisionIndex >= visibleWindow.startRevisionIndex
          && parsed.rightRevisionIndex <= visibleWindow.endRevisionIndex;
      });
    case 'adjacent':
    default:
      return Array.from(
        { length: visibleWindow.endRevisionIndex - visibleWindow.startRevisionIndex },
        (_, index) => buildPairKey(visibleWindow.startRevisionIndex + index, visibleWindow.startRevisionIndex + index + 1)
      );
  }
}

export function getVisiblePairOverlays(
  session: Pick<NWayCompareSession, 'pairProjection' | 'rawSnapshots' | 'adjacentPairs' | 'globalRows'>,
  visibleWindow: VisibleRevisionWindow
): readonly ComparePairOverlay[] {
  return getVisiblePairKeys(session.pairProjection, visibleWindow)
    .map((key) => getPairOverlay(session, key))
    .filter((pair): pair is ComparePairOverlay => pair !== undefined);
}

export function getPairOverlay(
  session: Pick<NWayCompareSession, 'rawSnapshots' | 'adjacentPairs' | 'globalRows'>,
  key: string
): ComparePairOverlay | undefined {
  const cache = getPairOverlayCache(session);
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }

  const parsed = parsePairKey(key);
  if (!parsed || parsed.rightRevisionIndex >= session.rawSnapshots.length) {
    return undefined;
  }

  if (parsed.rightRevisionIndex === parsed.leftRevisionIndex + 1) {
    const adjacent = session.adjacentPairs.find((pair) => pair.key === key);
    if (adjacent) {
      cache.set(key, adjacent);
      return adjacent;
    }
  }

  const left = session.rawSnapshots[parsed.leftRevisionIndex];
  const right = session.rawSnapshots[parsed.rightRevisionIndex];
  if (!left || !right) {
    return undefined;
  }

  const overlay = {
    key,
    leftRevisionIndex: parsed.leftRevisionIndex,
    rightRevisionIndex: parsed.rightRevisionIndex,
    label: `${left.revisionLabel}-${right.revisionLabel}`,
    changedRowNumbers: session.globalRows
      .filter((row) => isPairRowChanged(row.cells[parsed.leftRevisionIndex], row.cells[parsed.rightRevisionIndex]))
      .map((row) => row.rowNumber)
  };
  cache.set(key, overlay);
  return overlay;
}

function isPairRowChanged(
  left: NWayCompareSession['globalRows'][number]['cells'][number],
  right: NWayCompareSession['globalRows'][number]['cells'][number]
): boolean {
  if (left.present !== right.present) {
    return true;
  }

  if (!left.present && !right.present) {
    return false;
  }

  return left.text !== right.text;
}

function selectFocusedPairKey(visiblePairKeys: readonly string[], activeRevisionIndex: number): string | undefined {
  const candidates = visiblePairKeys
    .map((key) => {
      const parsed = parsePairKey(key);
      return parsed ? { key, pair: parsed } : undefined;
    })
    .filter((entry): entry is { readonly key: string; readonly pair: { readonly leftRevisionIndex: number; readonly rightRevisionIndex: number } } => (
      !!entry
      && (entry.pair.leftRevisionIndex === activeRevisionIndex || entry.pair.rightRevisionIndex === activeRevisionIndex)
    ));

  if (candidates.length === 0) {
    return undefined;
  }

  candidates.sort((left, right) => compareFocusedPairCandidate(left.pair, right.pair, activeRevisionIndex));
  return candidates[0].key;
}

function compareFocusedPairCandidate(
  left: { readonly leftRevisionIndex: number; readonly rightRevisionIndex: number },
  right: { readonly leftRevisionIndex: number; readonly rightRevisionIndex: number },
  activeRevisionIndex: number
): number {
  const leftDistance = getFocusedPairDistance(left, activeRevisionIndex);
  const rightDistance = getFocusedPairDistance(right, activeRevisionIndex);
  if (leftDistance !== rightDistance) {
    return leftDistance - rightDistance;
  }

  const leftDirection = left.leftRevisionIndex === activeRevisionIndex ? 0 : 1;
  const rightDirection = right.leftRevisionIndex === activeRevisionIndex ? 0 : 1;
  if (leftDirection !== rightDirection) {
    return leftDirection - rightDirection;
  }

  if (left.leftRevisionIndex !== right.leftRevisionIndex) {
    return left.leftRevisionIndex - right.leftRevisionIndex;
  }

  return left.rightRevisionIndex - right.rightRevisionIndex;
}

function getFocusedPairDistance(
  pair: { readonly leftRevisionIndex: number; readonly rightRevisionIndex: number },
  activeRevisionIndex: number
): number {
  const partnerRevisionIndex = pair.leftRevisionIndex === activeRevisionIndex
    ? pair.rightRevisionIndex
    : pair.leftRevisionIndex;
  return Math.abs(partnerRevisionIndex - activeRevisionIndex);
}

function getPairOverlayCache(session: object): Map<string, ComparePairOverlay> {
  let cache = pairOverlayCache.get(session);
  if (!cache) {
    cache = new Map<string, ComparePairOverlay>();
    pairOverlayCache.set(session, cache);
  }

  return cache;
}
