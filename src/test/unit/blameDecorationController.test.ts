import * as assert from 'assert';
import * as vscode from 'vscode';

import { NWayCompareSession, RepoContext } from '../../adapters/common/types';
import { RepositoryRegistry } from '../../application/repositoryRegistry';
import { createProjectedLineMap } from '../../application/sessionRowProjection';
import { SessionService } from '../../application/sessionService';
import { UriFactory } from '../../infrastructure/fs/uriFactory';
import { BlameDecorationController } from '../../presentation/decorations/blameDecorationController';
import { OutputLogger } from '../../util/output';

suite('Unit: BlameDecorationController', () => {
  test('maps compare document heatmap lines to global rows', () => {
    const sessionService = new SessionService();
    const uriFactory = new UriFactory(new RepositoryRegistry());
    const session = sessionService.createBrowserSession(createSession('session-blame'));
    const compareUri = uriFactory.createSessionDocumentUri(session.id, 0, 1, 'src/sample.ts', 'r1');
    sessionService.replaceVisibleWindowBindings(session.id, [
      {
        sessionId: session.id,
        revisionIndex: 1,
        revisionId: 'rev-1',
        relativePath: 'src/sample.ts',
        rawUri: session.rawSnapshots[1].rawUri,
        documentUri: compareUri,
        lineNumberSpace: 'globalRow',
        windowStart: 0
      }
    ]);

    const controller = new BlameDecorationController(
      {} as never,
      sessionService,
      new OutputLogger('BlameDecorationController Test')
    );

    const heatmap = (controller as unknown as {
      getSessionHeatmap(editor: vscode.TextEditor): { readonly lines: readonly { readonly lineNumber: number }[] } | undefined;
    }).getSessionHeatmap({
      document: {
        uri: compareUri
      } as vscode.TextDocument
    } as vscode.TextEditor);

    assert.deepStrictEqual(heatmap?.lines.map((line) => line.lineNumber), [1, 2]);

    controller.dispose();
  });

  test('skips hidden rows and maps visible rows to projected document lines', () => {
    const sessionService = new SessionService();
    const uriFactory = new UriFactory(new RepositoryRegistry());
    const session = sessionService.createBrowserSession(createSession('session-blame-projected'));
    const compareUri = uriFactory.createSessionDocumentUri(session.id, 0, 1, 'src/sample.ts', 'r1');
    sessionService.replaceVisibleWindowBindings(session.id, [
      {
        sessionId: session.id,
        revisionIndex: 1,
        revisionId: 'rev-1',
        relativePath: 'src/sample.ts',
        rawUri: session.rawSnapshots[1].rawUri,
        documentUri: compareUri,
        lineNumberSpace: 'globalRow',
        windowStart: 0,
        projectedGlobalRows: [2],
        projectedLineMap: createProjectedLineMap([2])
      }
    ]);

    const controller = new BlameDecorationController(
      {} as never,
      sessionService,
      new OutputLogger('BlameDecorationController Test')
    );

    const heatmap = (controller as unknown as {
      getSessionHeatmap(editor: vscode.TextEditor): { readonly lines: readonly { readonly lineNumber: number }[] } | undefined;
    }).getSessionHeatmap({
      document: {
        uri: compareUri
      } as vscode.TextDocument
    } as vscode.TextEditor);

    assert.deepStrictEqual(heatmap?.lines.map((line) => line.lineNumber), [1]);

    controller.dispose();
  });
});

function createSession(sessionId: string): NWayCompareSession {
  const uriFactory = new UriFactory(new RepositoryRegistry());
  const repo: RepoContext = {
    kind: 'git',
    repoRoot: 'c:/repo',
    repoId: 'repo123'
  };

  return {
    id: sessionId,
    uri: uriFactory.createSessionUri(sessionId, 'src/sample.ts'),
    repo,
    originalUri: vscode.Uri.file('c:/repo/src/sample.ts'),
    relativePath: 'src/sample.ts',
    revisions: [
      { id: 'rev-0', shortLabel: 'r0' },
      { id: 'rev-1', shortLabel: 'r1' }
    ],
    createdAt: Date.now(),
    rowCount: 2,
    rawSnapshots: [0, 1].map((index) => ({
      snapshotUri: vscode.Uri.file(`c:/repo/.fukusa-shadow/revisions/rev-${index}/src/sample.ts`),
      rawUri: vscode.Uri.file(`c:/repo/.fukusa-shadow/revisions/rev-${index}/src/sample.ts`),
      revisionIndex: index,
      revisionId: `rev-${index}`,
      revisionLabel: `r${index}`,
      relativePath: 'src/sample.ts',
      lineMap: {
        rowToOriginalLine: new Map([[1, 1], [2, 2]]),
        originalLineToRow: new Map([[1, 1], [2, 2]])
      }
    })),
    globalRows: [
      {
        rowNumber: 1,
        cells: [
          { revisionIndex: 0, rowNumber: 1, present: true, text: 'a', originalLineNumber: 1, blameAgeBucket: 1 },
          { revisionIndex: 1, rowNumber: 1, present: true, text: 'a', originalLineNumber: 1, blameAgeBucket: 1 }
        ]
      },
      {
        rowNumber: 2,
        cells: [
          { revisionIndex: 0, rowNumber: 2, present: false, text: '', blameAgeBucket: 2 },
          { revisionIndex: 1, rowNumber: 2, present: true, text: 'b', originalLineNumber: 2, blameAgeBucket: 2 }
        ]
      }
    ],
    adjacentPairs: [
      {
        key: '0:1',
        leftRevisionIndex: 0,
        rightRevisionIndex: 1,
        label: 'r0-r1',
        changedRowNumbers: [2]
      }
    ],
    pairProjection: { mode: 'adjacent' },
    surfaceMode: 'native'
  };
}
