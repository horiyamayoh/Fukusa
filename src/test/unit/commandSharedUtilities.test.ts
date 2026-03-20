import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';

import { RepoContext, ResolvedResource } from '../../adapters/common/types';
import {
  getActivePairOrNotify,
  getCollapseProjectionOrNotify,
  getRepoCacheId,
  getSnapshotTargetOrNotify,
  getSessionTargetOrNotify,
  openSnapshotDocument,
  resolveTargetResource,
  warmSnapshots
} from '../../commands/shared';
import { CommandContext } from '../../commands/commandContext';
import { SessionService } from '../../application/sessionService';
import { createRevisions, createSession } from '../helpers/sessionHelpers';

const TEST_REPO: RepoContext = {
  kind: 'git',
  repoRoot: 'c:/repo',
  repoId: 'repo123'
};

const TEST_RESOURCE: ResolvedResource = {
  repo: TEST_REPO,
  relativePath: 'src/sample.ts',
  originalUri: vscode.Uri.file('c:/repo/src/sample.ts')
};

suite('Unit: commands/shared utilities', () => {
  teardown(() => {
    sinon.restore();
  });

  test('resolveTargetResource uses the provided uri and logs the resolved resource', async () => {
    const resolvedUri = vscode.Uri.file('c:/repo/src/sample.ts');
    const context = createContext();
    context.repositoryService.resolveResource = sinon.stub().resolves({
      ...TEST_RESOURCE,
      originalUri: resolvedUri
    }) as never;

    const resolved = await resolveTargetResource(context, resolvedUri);

    assert.deepStrictEqual(resolved, {
      ...TEST_RESOURCE,
      originalUri: resolvedUri
    });
    assert.strictEqual((context.output.info as sinon.SinonStub).callCount, 1);
  });

  test('resolveTargetResource notifies when no file is available', async () => {
    const showInfoStub = sinon.stub(vscode.window, 'showInformationMessage').resolves(undefined);
    const context = createContext();
    (sinon as unknown as {
      replaceGetter(object: object, property: string, getter: () => unknown): void;
    }).replaceGetter(vscode.window, 'activeTextEditor', () => undefined);

    const resolved = await resolveTargetResource(context);

    assert.strictEqual(resolved, undefined);
    assert.strictEqual(showInfoStub.callCount, 1);
  });

  test('warmSnapshots preloads snapshot bytes for the requested history range', async () => {
    const context = createContext();
    const getSnapshotStub = sinon.stub().resolves(Buffer.from('snapshot', 'utf8'));
    context.repositoryService.getAdapter = sinon.stub().returns({
      getSnapshot: getSnapshotStub
    }) as never;
    context.revisionPickerService.getHistory = sinon.stub().resolves([
      { id: 'rev-1', shortLabel: 'r1' },
      { id: 'rev-2', shortLabel: 'r2' }
    ]) as never;

    await warmSnapshots(context, TEST_RESOURCE, 2);

    assert.strictEqual((context.cacheService.getOrLoadBytes as sinon.SinonStub).callCount, 2);
    assert.deepStrictEqual(getSnapshotStub.getCalls().map((call) => call.args.slice(1)), [
      ['src/sample.ts', 'rev-1'],
      ['src/sample.ts', 'rev-2']
    ]);
  });

  test('getSessionTargetOrNotify resolves explicit and active sessions', () => {
    const context = createContext();
    const first = context.sessionService.createBrowserSession(createSession('session-a', createRevisions(2)));
    const second = context.sessionService.createBrowserSession(createSession('session-b', createRevisions(2)));

    const targeted = getSessionTargetOrNotify(context, first.id);
    const active = getSessionTargetOrNotify(context);

    assert.strictEqual(targeted?.id, first.id);
    assert.strictEqual(active?.id, second.id);
  });

  test('getSnapshotTargetOrNotify resolves tree snapshot targets and reports missing revisions', () => {
    const showInfoStub = sinon.stub(vscode.window, 'showInformationMessage').resolves(undefined);
    const context = createContext();
    const session = context.sessionService.createBrowserSession(createSession('session-snapshots', createRevisions(2)));

    const resolved = getSnapshotTargetOrNotify(context, {
      kind: 'snapshot',
      sessionId: session.id,
      snapshot: { revisionIndex: 1 }
    });
    const missing = getSnapshotTargetOrNotify(context, {
      kind: 'snapshot',
      sessionId: session.id,
      snapshot: { revisionIndex: 99 }
    });

    assert.strictEqual(resolved?.snapshot.revisionIndex, 1);
    assert.strictEqual(missing, undefined);
    assert.strictEqual(showInfoStub.callCount, 1);
  });

  test('getActivePairOrNotify and getCollapseProjectionOrNotify reflect session state', () => {
    const showInfoStub = sinon.stub(vscode.window, 'showInformationMessage').resolves(undefined);
    const context = createContext();
    const pairedSession = context.sessionService.createBrowserSession(createSession('session-pair', createRevisions(3)));
    const singleSession = context.sessionService.createBrowserSession(createSession('session-single', createRevisions(1)));
    context.sessionService.toggleCollapseUnchanged(singleSession.id);

    const pairResult = getActivePairOrNotify(context, pairedSession.id);
    const missingPairResult = getActivePairOrNotify(context, singleSession.id);
    const collapsedResult = getCollapseProjectionOrNotify(context, singleSession.id);

    assert.strictEqual(pairResult?.pair.key, '0:1');
    assert.strictEqual(missingPairResult, undefined);
    assert.strictEqual(collapsedResult?.rowProjectionState.collapseUnchanged, true);
    assert.strictEqual(showInfoStub.callCount, 1);
  });

  test('getRepoCacheId delegates to the normalized repo cache id format', () => {
    assert.strictEqual(getRepoCacheId(TEST_RESOURCE), 'git:repo123');
  });

  test('openSnapshotDocument resolves the compatibility uri before opening an editor', async () => {
    const context = createContext();
    const resolvedUri = vscode.Uri.file('c:/repo/.fukusa-shadow/revisions/rev-1/src/sample.ts');
    const textDocument = { uri: resolvedUri } as vscode.TextDocument;
    const openTextDocumentStub = sinon.stub(vscode.workspace, 'openTextDocument').resolves(textDocument);
    const showTextDocumentStub = sinon.stub(vscode.window, 'showTextDocument').resolves({ document: textDocument } as vscode.TextEditor);
    context.compatibilityService.resolveSnapshotUri = sinon.stub().resolves(resolvedUri) as never;

    const editor = await openSnapshotDocument(context, {
      snapshotUri: vscode.Uri.parse('multidiff://git/repo123/src/sample.ts?rev=rev-1&path=src%2Fsample.ts')
    });

    assert.strictEqual(editor.document.uri.toString(), resolvedUri.toString());
    assert.strictEqual(openTextDocumentStub.callCount, 1);
    assert.strictEqual(showTextDocumentStub.callCount, 1);
  });
});

function createContext(): CommandContext {
  const sessionService = new SessionService();

  return {
    output: {
      info: sinon.stub(),
      warn: sinon.stub(),
      error: sinon.stub()
    } as never,
    repositoryService: {
      resolveResource: sinon.stub().resolves(TEST_RESOURCE),
      getAdapter: sinon.stub().returns({
        getSnapshot: sinon.stub().resolves(Buffer.from('snapshot', 'utf8'))
      })
    } as never,
    revisionPickerService: {
      getHistory: sinon.stub().resolves([])
    } as never,
    uriFactory: {} as never,
    compatibilityService: {
      resolveSnapshotUri: sinon.stub().callsFake(async (uri: vscode.Uri) => uri)
    } as never,
    sessionBuilderService: {} as never,
    sessionService,
    compareSessionController: {} as never,
    cacheService: {
      getOrLoadBytes: sinon.stub().callsFake(async (_descriptor: unknown, loader: () => Promise<Uint8Array>) => ({
        value: await loader(),
        source: 'loader'
      }))
    } as never,
    blameDecorationController: {} as never
  } as unknown as CommandContext;
}
