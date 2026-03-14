import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';

import { RepoContext, RevisionRef } from '../../adapters/common/types';
import { LanguageFeatureCompatibilityService } from '../../application/languageFeatureCompatibilityService';
import { RepositoryRegistry } from '../../application/repositoryRegistry';
import { SessionService } from '../../application/sessionService';
import { UriFactory } from '../../infrastructure/fs/uriFactory';
import { OutputLogger } from '../../util/output';
import { EditorLayoutController } from '../../presentation/native/editorLayoutController';
import { NativeDiffSessionController } from '../../presentation/native/nativeDiffSessionController';

suite('Integration: NativeDiffSessionController', () => {
  class TestLayoutController extends EditorLayoutController {
    public readonly calls: number[] = [];

    public override async setLayout(columns: number): Promise<void> {
      this.calls.push(columns);
    }
  }

  test('opens and shifts visible diff windows', async () => {
    const executeStub = sinon.stub(vscode.commands, 'executeCommand').resolves(undefined);
    const uriFactory = new UriFactory(new RepositoryRegistry());
    const sessionService = new SessionService(uriFactory);
    const layoutController = new TestLayoutController();
    const compatibilityService = {
      resolveSnapshotUri: async (uri: vscode.Uri) => uri
    } as unknown as LanguageFeatureCompatibilityService;
    const controller = new NativeDiffSessionController(
      sessionService,
      layoutController,
      compatibilityService,
      new OutputLogger('NativeDiffSession Test')
    );
    const repo: RepoContext = {
      kind: 'git',
      repoRoot: 'c:/repo',
      repoId: 'repo123'
    };
    const revisions: RevisionRef[] = [
      { id: 'a1', shortLabel: 'a1' },
      { id: 'b2', shortLabel: 'b2' },
      { id: 'c3', shortLabel: 'c3' },
      { id: 'd4', shortLabel: 'd4' }
    ];

    const session = sessionService.createSession(repo, vscode.Uri.file('c:/repo/src/sample.ts'), 'src/sample.ts', revisions, 'adjacent', 2);
    await controller.openSession(session);
    await controller.shiftWindow(1);

    assert.deepStrictEqual(layoutController.calls, [2, 2]);
    assert.strictEqual(executeStub.callCount, 4);
    assert.strictEqual(session.visibleStartPairIndex, 1);

    sinon.restore();
  });
});
