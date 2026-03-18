import * as vscode from 'vscode';

import { NWayCompareSession, RawSnapshot } from '../../adapters/common/types';

export interface PrototypeComparePanelInput {
  readonly session: NWayCompareSession;
  readonly visibleSnapshots: readonly RawSnapshot[];
}

export interface PrototypeComparePanelActions {
  readonly openSnapshot: (snapshot: RawSnapshot) => Promise<void>;
  readonly openPairDiff: (left: RawSnapshot, right: RawSnapshot) => Promise<void>;
}

export class PrototypeComparePanel {
  public open(
    extensionUri: vscode.Uri,
    input: PrototypeComparePanelInput,
    actions: PrototypeComparePanelActions
  ): vscode.WebviewPanel {
    const panel = vscode.window.createWebviewPanel(
      'multidiff.prototypeCompare',
      `Fukusa Prototype | ${input.session.relativePath}`,
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        localResourceRoots: [extensionUri]
      }
    );

    panel.webview.html = renderPrototypeHtml(input);
    panel.webview.onDidReceiveMessage((message: unknown) => {
      void this.handleMessage(message, input.visibleSnapshots, actions);
    });

    return panel;
  }

  private async handleMessage(
    message: unknown,
    visibleSnapshots: readonly RawSnapshot[],
    actions: PrototypeComparePanelActions
  ): Promise<void> {
    if (!message || typeof message !== 'object') {
      return;
    }

    const payload = message as { readonly type?: string; readonly revisionIndex?: number; readonly leftIndex?: number; readonly rightIndex?: number };
    if (payload.type === 'openSnapshot' && payload.revisionIndex !== undefined) {
      const snapshot = visibleSnapshots.find((entry) => entry.revisionIndex === payload.revisionIndex);
      if (snapshot) {
        await actions.openSnapshot(snapshot);
      }
      return;
    }

    if (payload.type === 'openPairDiff' && payload.leftIndex !== undefined && payload.rightIndex !== undefined) {
      const left = visibleSnapshots.find((entry) => entry.revisionIndex === payload.leftIndex);
      const right = visibleSnapshots.find((entry) => entry.revisionIndex === payload.rightIndex);
      if (left && right) {
        await actions.openPairDiff(left, right);
      }
    }
  }
}

function renderPrototypeHtml(input: PrototypeComparePanelInput): string {
  const columns = input.visibleSnapshots.map((snapshot) => (
    `<div class="column">
      <div class="column__header">
        <strong>${escapeHtml(snapshot.revisionLabel)}</strong>
        <button data-open-snapshot="${snapshot.revisionIndex}">Snapshot</button>
      </div>
      <pre>${escapeHtml(renderColumnText(input.session, snapshot.revisionIndex))}</pre>
    </div>`
  )).join('');

  const pairActions = input.visibleSnapshots.slice(0, -1).map((snapshot, index) => (
    `<button data-open-pair="${snapshot.revisionIndex}:${input.visibleSnapshots[index + 1].revisionIndex}">
      Diff ${escapeHtml(snapshot.revisionLabel)}-${escapeHtml(input.visibleSnapshots[index + 1].revisionLabel)}
    </button>`
  )).join('');

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      :root {
        color-scheme: light dark;
      }
      body {
        margin: 0;
        font-family: Consolas, "Liberation Mono", Menlo, monospace;
        background:
          radial-gradient(circle at top left, rgba(80, 120, 120, 0.18), transparent 28%),
          linear-gradient(180deg, rgba(20, 32, 40, 0.92), rgba(12, 18, 24, 0.96));
        color: var(--vscode-editor-foreground);
      }
      .toolbar {
        position: sticky;
        top: 0;
        display: flex;
        gap: 8px;
        padding: 12px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.12);
        background: rgba(8, 12, 16, 0.88);
        backdrop-filter: blur(10px);
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(${Math.max(1, input.visibleSnapshots.length)}, minmax(280px, 1fr));
        gap: 12px;
        padding: 12px;
      }
      .column {
        min-width: 0;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        overflow: hidden;
        background: rgba(255, 255, 255, 0.04);
      }
      .column__header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
        padding: 10px 12px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }
      pre {
        margin: 0;
        max-height: 72vh;
        overflow: auto;
        padding: 12px;
        line-height: 1.45;
      }
      button {
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 999px;
        padding: 5px 10px;
        background: rgba(255, 255, 255, 0.08);
        color: inherit;
        cursor: pointer;
      }
    </style>
  </head>
  <body>
    <div class="toolbar">${pairActions}</div>
    <div class="grid">${columns}</div>
    <script>
      const vscode = acquireVsCodeApi();
      document.querySelectorAll('[data-open-snapshot]').forEach((button) => {
        button.addEventListener('click', () => {
          vscode.postMessage({
            type: 'openSnapshot',
            revisionIndex: Number(button.getAttribute('data-open-snapshot'))
          });
        });
      });
      document.querySelectorAll('[data-open-pair]').forEach((button) => {
        button.addEventListener('click', () => {
          const [leftIndex, rightIndex] = String(button.getAttribute('data-open-pair')).split(':').map(Number);
          vscode.postMessage({
            type: 'openPairDiff',
            leftIndex,
            rightIndex
          });
        });
      });
    </script>
  </body>
</html>`;
}

function renderColumnText(session: NWayCompareSession, revisionIndex: number): string {
  return session.globalRows
    .map((row) => {
      const cell = row.cells[revisionIndex];
      return cell.present ? cell.text : '';
    })
    .join('\n');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
