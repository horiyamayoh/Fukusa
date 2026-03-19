import * as vscode from 'vscode';

import { ComparePairProjection, RevisionRef } from '../adapters/common/types';
import { buildPairKey, createPresetPairProjection } from '../application/comparePairing';

interface PairProjectionQuickPickItem extends vscode.QuickPickItem {
  readonly pairProjectionMode: ComparePairProjection['mode'];
}

interface CustomPairQuickPickItem extends vscode.QuickPickItem {
  readonly pairKey: string;
}

export interface PairProjectionPickerOptions {
  readonly requestedPairProjection?: ComparePairProjection;
  readonly currentPairProjection?: ComparePairProjection;
  readonly pairProjectionPlaceHolder?: string;
  readonly customPairPlaceHolder?: string;
}

export async function pickPairProjection(
  revisions: readonly RevisionRef[],
  options: PairProjectionPickerOptions = {}
): Promise<ComparePairProjection | undefined> {
  if (options.requestedPairProjection || revisions.length <= 2) {
    return options.requestedPairProjection ?? createPresetPairProjection('adjacent');
  }

  const selection = await vscode.window.showQuickPick(
    buildPairProjectionItems(options.currentPairProjection),
    {
      placeHolder: options.pairProjectionPlaceHolder ?? 'Choose how Fukusa should project pairs inside the N-way compare session.'
    }
  );

  if (!selection) {
    return undefined;
  }

  if (selection.pairProjectionMode === 'custom') {
    return pickCustomPairProjection(revisions, options.currentPairProjection, options.customPairPlaceHolder);
  }

  return createPresetPairProjection(selection.pairProjectionMode);
}

function buildPairProjectionItems(currentPairProjection?: ComparePairProjection): readonly PairProjectionQuickPickItem[] {
  return [
    {
      label: 'Adjacent',
      description: 'Compare neighboring visible revisions: A-B, B-C, C-D',
      detail: currentPairProjection?.mode === 'adjacent' ? 'Current projection' : undefined,
      pairProjectionMode: 'adjacent'
    },
    {
      label: 'Base',
      description: 'Compare the leftmost visible revision against each visible column',
      detail: currentPairProjection?.mode === 'base' ? 'Current projection' : undefined,
      pairProjectionMode: 'base'
    },
    {
      label: 'All',
      description: 'Project every visible pair: A-B, A-C, B-C, ...',
      detail: currentPairProjection?.mode === 'all' ? 'Current projection' : undefined,
      pairProjectionMode: 'all'
    },
    {
      label: 'Custom...',
      description: 'Choose an explicit ordered set of visible pairs',
      detail: currentPairProjection?.mode === 'custom'
        ? `Current projection (${currentPairProjection.pairKeys?.length ?? 0} pairs)`
        : undefined,
      pairProjectionMode: 'custom'
    }
  ] satisfies readonly PairProjectionQuickPickItem[];
}

async function pickCustomPairProjection(
  revisions: readonly RevisionRef[],
  currentPairProjection?: ComparePairProjection,
  placeHolder?: string
): Promise<ComparePairProjection | undefined> {
  const selection = await vscode.window.showQuickPick(
    buildCustomPairItems(revisions, currentPairProjection),
    {
      canPickMany: true,
      placeHolder: placeHolder ?? 'Choose which revision pairs Fukusa should project inside this N-way compare session.'
    }
  );

  if (!selection) {
    return undefined;
  }

  if (selection.length === 0) {
    void vscode.window.showWarningMessage('Choose at least one pair for a custom N-way projection.');
    return undefined;
  }

  return {
    mode: 'custom',
    pairKeys: selection.map((item) => item.pairKey)
  };
}

function buildCustomPairItems(
  revisions: readonly RevisionRef[],
  currentPairProjection?: ComparePairProjection
): readonly CustomPairQuickPickItem[] {
  const currentPairKeys = currentPairProjection?.mode === 'custom'
    ? new Set(currentPairProjection.pairKeys ?? [])
    : undefined;
  const items: CustomPairQuickPickItem[] = [];
  for (let leftRevisionIndex = 0; leftRevisionIndex < revisions.length - 1; leftRevisionIndex += 1) {
    for (let rightRevisionIndex = leftRevisionIndex + 1; rightRevisionIndex < revisions.length; rightRevisionIndex += 1) {
      const left = revisions[leftRevisionIndex];
      const right = revisions[rightRevisionIndex];
      const pairKey = buildPairKey(leftRevisionIndex, rightRevisionIndex);
      items.push({
        label: `${left.shortLabel} <-> ${right.shortLabel}`,
        description: `Columns ${leftRevisionIndex + 1} and ${rightRevisionIndex + 1}`,
        detail: `${left.id} -> ${right.id}`,
        picked: currentPairKeys ? currentPairKeys.has(pairKey) : rightRevisionIndex === leftRevisionIndex + 1,
        pairKey
      });
    }
  }

  return items;
}
