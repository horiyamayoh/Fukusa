import * as assert from 'assert';
import * as vscode from 'vscode';

import { CompareSourceDocument, NWayCompareSession, RepoContext } from '../../adapters/common/types';
import { RepositoryRegistry } from '../../application/repositoryRegistry';
import { SessionAlignmentService } from '../../application/sessionAlignmentService';
import { createProjectedLineMap } from '../../application/sessionRowProjection';
import { SessionService } from '../../application/sessionService';
import { UriFactory } from '../../infrastructure/fs/uriFactory';
import { AlignedSessionDocumentProvider } from '../../infrastructure/fs/alignedSessionDocumentProvider';
import { OutputLogger } from '../../util/output';

suite('Unit: AlignedSessionDocumentProvider', () => {
  test('renders aligned session documents with placeholder blank rows and identical line counts', () => {
    const alignment = new SessionAlignmentService().buildState([
      createSource(0, 'A', 'top\nshared'),
      createSource(1, 'B', 'shared'),
      createSource(2, 'C', 'top\nshared')
    ]);
    const session = createSession(alignment);
    const sessionService = new SessionService();
    sessionService.createBrowserSession(session);
    const uriFactory = new UriFactory(new RepositoryRegistry());
    const provider = new AlignedSessionDocumentProvider(sessionService, uriFactory, new OutputLogger('AlignedSessionDocumentProvider Test'));

    const first = provider.provideTextDocumentContent(uriFactory.createSessionDocumentUri(session.id, 0, 0, 'src/sample.ts', 'A'));
    const second = provider.provideTextDocumentContent(uriFactory.createSessionDocumentUri(session.id, 0, 1, 'src/sample.ts', 'B'));
    const third = provider.provideTextDocumentContent(uriFactory.createSessionDocumentUri(session.id, 0, 2, 'src/sample.ts', 'C'));

    assert.deepStrictEqual(first.split('\n'), ['top', 'shared']);
    assert.deepStrictEqual(second.split('\n'), ['', 'shared']);
    assert.deepStrictEqual(third.split('\n'), ['top', 'shared']);
    assert.strictEqual(first.split('\n').length, session.rowCount);
    assert.strictEqual(second.split('\n').length, session.rowCount);
    assert.strictEqual(third.split('\n').length, session.rowCount);
  });

  test('renders only projected global rows for native compare bindings', () => {
    const alignment = new SessionAlignmentService().buildState([
      createSource(0, 'A', 'one\ntwo\nthree\nfour'),
      createSource(1, 'B', 'one\ntwo\nthree\nfour')
    ]);
    const session = createSession(alignment);
    const sessionService = new SessionService();
    sessionService.createBrowserSession(session);
    const uriFactory = new UriFactory(new RepositoryRegistry());
    const provider = new AlignedSessionDocumentProvider(sessionService, uriFactory, new OutputLogger('AlignedSessionDocumentProvider Test'));
    const compareUri = uriFactory.createSessionDocumentUri(session.id, 0, 0, 'src/sample.ts', 'A');
    sessionService.replaceVisibleWindowBindings(session.id, [{
      sessionId: session.id,
      revisionIndex: 0,
      revisionId: 'A',
      relativePath: 'src/sample.ts',
      rawUri: session.rawSnapshots[0].rawUri,
      documentUri: compareUri,
      lineNumberSpace: 'globalRow',
      windowStart: 0,
      projectedGlobalRows: [2, 4],
      projectedLineMap: createProjectedLineMap([2, 4])
    }]);

    const projected = provider.provideTextDocumentContent(compareUri);

    assert.deepStrictEqual(projected.split('\n'), ['two', 'four']);
  });
});

function createSource(revisionIndex: number, revisionId: string, text: string): CompareSourceDocument {
  return {
    revisionIndex,
    revisionId,
    revisionLabel: revisionId,
    relativePath: 'src/sample.ts',
    snapshotUri: vscode.Uri.file(`c:/repo/${revisionId}.snapshot.ts`),
    rawUri: vscode.Uri.file(`c:/repo/${revisionId}.raw.ts`),
    text
  };
}

function createSession(alignment: ReturnType<SessionAlignmentService['buildState']>): NWayCompareSession {
  const uriFactory = new UriFactory(new RepositoryRegistry());
  const repo: RepoContext = {
    kind: 'git',
    repoRoot: 'c:/repo',
    repoId: 'repo123'
  };

  return {
    id: 'session-doc',
    uri: uriFactory.createSessionUri('session-doc', 'src/sample.ts'),
    repo,
    originalUri: vscode.Uri.file('c:/repo/src/sample.ts'),
    relativePath: 'src/sample.ts',
    revisions: [
      { id: 'A', shortLabel: 'A' },
      { id: 'B', shortLabel: 'B' },
      { id: 'C', shortLabel: 'C' }
    ],
    createdAt: Date.now(),
    rowCount: alignment.rowCount,
    rawSnapshots: alignment.rawSnapshots,
    globalRows: alignment.globalRows,
    adjacentPairs: alignment.adjacentPairs,
    pairProjection: { mode: 'adjacent' },
    surfaceMode: 'native'
  };
}
