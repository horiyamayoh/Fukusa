import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as vscode from 'vscode';

import { GitAdapter } from '../../adapters/git/gitAdapter';
import { GitApiService } from '../../adapters/git/gitApi';
import { GitCli } from '../../adapters/git/gitCli';
import { OutputLogger } from '../../util/output';
import { commandExists, createGitRepoFixture } from '../helpers/repoHelpers';

suite('Integration: GitAdapter', function () {
  test('reads history, snapshot, and blame from a real git repository', async function () {
    if (!commandExists('git')) {
      this.skip();
      return;
    }

    const fixture = await createGitRepoFixture();
    const output = new OutputLogger('GitAdapter Test');
    const gitApi = { getRepositoryRoot: () => undefined } as unknown as GitApiService;
    const adapter = new GitAdapter(gitApi, new GitCli(), output);

    const repo = await adapter.resolveRepoContext(vscode.Uri.file(fixture.filePath));
    assert.ok(repo);

    const history = await adapter.getHistory(repo!, 'sample.ts', 10);
    assert.strictEqual(history.length, 2);

    const snapshot = await adapter.getSnapshot(repo!, 'sample.ts', fixture.revisions[0]);
    assert.match(Buffer.from(snapshot).toString('utf8'), /value = 1/);

    const blame = await adapter.getBlame(repo!, 'sample.ts');
    assert.ok(blame.length >= 2);
    assert.ok(blame[0].revision.length >= 7);

    output.dispose();
    try {
      await fs.rm(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    } catch {
      // Windows can keep transient file handles in temp git repos.
    }
  });
});
