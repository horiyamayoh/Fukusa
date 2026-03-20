import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';

import {
  CompareAlignmentState,
  CompareSourceDocument,
  RepoContext,
  ResolvedResource,
  RevisionRef
} from '../../adapters/common/types';
import { SessionAlignmentService } from '../../application/sessionAlignmentService';
import { SessionBuilderService } from '../../application/sessionBuilderService';
import { SessionService } from '../../application/sessionService';
import { UriFactory } from '../../infrastructure/fs/uriFactory';
import { RepositoryRegistry } from '../../application/repositoryRegistry';

suite('Unit: SessionBuilderService', () => {
  const repo: RepoContext = {
    kind: 'git',
    repoRoot: 'c:/repo',
    repoId: 'repo123'
  };
  const resource: ResolvedResource = {
    repo,
    relativePath: 'src/sample.ts',
    originalUri: vscode.Uri.file('c:/repo/src/sample.ts')
  };

  teardown(() => {
    sinon.restore();
  });

  test('builds a session from loaded documents and normalizes pair projection', async () => {
    const sessionService = new SessionService();
    const uriFactory = new UriFactory(new RepositoryRegistry());
    const getSnapshotStub = sinon.stub();
    getSnapshotStub.onCall(0).resolves(Buffer.from('left line\n', 'utf8'));
    getSnapshotStub.onCall(1).resolves(Buffer.from('renamed line\n', 'utf8'));
    getSnapshotStub.onCall(2).resolves(Buffer.from('right line\n', 'utf8'));
    const buildStateStub = sinon.stub<Parameters<SessionAlignmentService['buildState']>, ReturnType<SessionAlignmentService['buildState']>>();
    buildStateStub.callsFake((sources) => createAlignmentState(sources));
    const output = {
      info: sinon.stub(),
      warn: sinon.stub()
    };
    const cacheService = {
      getOrLoadBytes: sinon.stub().callsFake(async (_descriptor: unknown, loader: () => Promise<Uint8Array>) => ({
        value: await loader(),
        source: 'loader'
      })),
      getOrLoadJson: sinon.stub().resolves({
        value: { rootPath: 'c:/repo/.fukusa-shadow/revisions/rev-0' },
        source: 'loader'
      })
    };
    const shadowWorkspaceService = {
      writeRawFile: sinon.stub().callsFake(async (_repo: RepoContext, revision: string, relativePath: string) => (
        vscode.Uri.file(`c:/repo/.fukusa-shadow/revisions/${revision}/${relativePath}`)
      )),
      materializeRevisionTree: sinon.stub().callsFake(async (_repo: RepoContext, revision: string) => (
        vscode.Uri.file(`c:/repo/.fukusa-shadow/revisions/${revision}`)
      ))
    };
    const service = new SessionBuilderService(
      {
        getAdapter: sinon.stub().returns({
          getSnapshot: getSnapshotStub
        })
      } as never,
      cacheService as never,
      {
        getHeatmap: sinon.stub().onFirstCall().resolves({
          resource,
          lines: [{
            lineNumber: 1,
            revision: 'rev-0',
            author: 'Ada',
            ageBucket: 0
          }]
        }).onSecondCall().resolves(undefined).onThirdCall().resolves(undefined)
      } as never,
      uriFactory,
      {
        buildState: buildStateStub
      } as never,
      shadowWorkspaceService as never,
      sessionService,
      output as never
    );
    const revisions: RevisionRef[] = [
      { id: 'rev-0', shortLabel: 'r0' },
      { id: 'rev-1', shortLabel: 'r1', relativePath: 'src/renamed.ts' },
      { id: 'rev-2', shortLabel: 'r2' }
    ];

    const session = await service.createSession(resource, revisions, {
      pairProjection: { mode: 'custom', pairKeys: ['0:2', '0:2', '9:10'] },
      surfaceMode: 'panel'
    });

    assert.strictEqual(session.surfaceMode, 'panel');
    assert.deepStrictEqual(session.pairProjection, {
      mode: 'custom',
      pairKeys: ['0:2']
    });
    assert.strictEqual(sessionService.getSession(session.id)?.id, session.id);
    assert.deepStrictEqual(getSnapshotStub.getCalls().map((call) => call.args.slice(1)), [
      ['src/sample.ts', 'rev-0'],
      ['src/renamed.ts', 'rev-1'],
      ['src/sample.ts', 'rev-2']
    ]);

    const loadedSources = buildStateStub.firstCall.args[0];
    assert.strictEqual(loadedSources[0]?.text, 'left line\n');
    assert.strictEqual(loadedSources[1]?.relativePath, 'src/renamed.ts');
    assert.strictEqual(loadedSources[0]?.blameLines?.[0]?.author, 'Ada');
    assert.strictEqual(output.info.callCount, 1);
  });

  test('logs a warning when background shadow materialization fails without aborting session creation', async () => {
    const sessionService = new SessionService();
    const uriFactory = new UriFactory(new RepositoryRegistry());
    const output = {
      info: sinon.stub(),
      warn: sinon.stub()
    };
    const service = new SessionBuilderService(
      {
        getAdapter: sinon.stub().returns({
          getSnapshot: sinon.stub().resolves(Buffer.from('content\n', 'utf8'))
        })
      } as never,
      {
        getOrLoadBytes: sinon.stub().callsFake(async (_descriptor: unknown, loader: () => Promise<Uint8Array>) => ({
          value: await loader(),
          source: 'loader'
        })),
        getOrLoadJson: sinon.stub().rejects(new Error('shadow tree unavailable'))
      } as never,
      {
        getHeatmap: sinon.stub().resolves(undefined)
      } as never,
      uriFactory,
      {
        buildState: sinon.stub().callsFake((sources: readonly CompareSourceDocument[]) => createAlignmentState(sources))
      } as never,
      {
        writeRawFile: sinon.stub().resolves(vscode.Uri.file('c:/repo/.fukusa-shadow/revisions/rev-0/src/sample.ts')),
        materializeRevisionTree: sinon.stub().resolves(vscode.Uri.file('c:/repo/.fukusa-shadow/revisions/rev-0'))
      } as never,
      sessionService,
      output as never
    );

    const session = await service.createSession(resource, [
      { id: 'rev-0', shortLabel: 'r0' }
    ]);
    await flushPromises();

    assert.ok(sessionService.getSession(session.id));
    assert.strictEqual(output.warn.callCount, 1);
    assert.match(String(output.warn.firstCall.args[0]), /Background shadow materialization failed for rev-0/);
  });
});

function createAlignmentState(sources: readonly CompareSourceDocument[]): CompareAlignmentState {
  return {
    rowCount: 1,
    rawSnapshots: sources.map((source) => ({
      snapshotUri: source.snapshotUri,
      rawUri: source.rawUri,
      revisionIndex: source.revisionIndex,
      revisionId: source.revisionId,
      revisionLabel: source.revisionLabel,
      relativePath: source.relativePath,
      lineMap: {
        rowToOriginalLine: new Map([[1, 1]]),
        originalLineToRow: new Map([[1, 1]])
      }
    })),
    globalRows: [{
      rowNumber: 1,
      cells: sources.map((source) => ({
        revisionIndex: source.revisionIndex,
        rowNumber: 1,
        present: true,
        text: source.text.trimEnd(),
        originalLineNumber: 1
      }))
    }],
    adjacentPairs: sources.slice(0, -1).map((source, index) => ({
      key: `${index}:${index + 1}`,
      leftRevisionIndex: index,
      rightRevisionIndex: index + 1,
      label: `${source.revisionLabel}-${sources[index + 1].revisionLabel}`,
      changedRowNumbers: [1]
    }))
  };
}

async function flushPromises(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}
