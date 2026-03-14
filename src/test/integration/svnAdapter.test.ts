import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as vscode from 'vscode';

import { SvnAdapter } from '../../adapters/svn/svnAdapter';
import { SvnCli } from '../../adapters/svn/svnCli';
import { OutputLogger } from '../../util/output';
import { commandExists, createSvnRepoFixture } from '../helpers/repoHelpers';

suite('Integration: SvnAdapter', function () {
  test('reads history, snapshot, and blame from a real svn working copy', async function () {
    if (!commandExists('svn') || !commandExists('svnadmin')) {
      this.skip();
      return;
    }

    const fixture = await createSvnRepoFixture();
    const output = new OutputLogger('SvnAdapter Test');
    const adapter = new SvnAdapter(new SvnCli(), output);

    const repo = await adapter.resolveRepoContext(vscode.Uri.file(fixture.filePath));
    assert.ok(repo);

    const history = await adapter.getHistory(repo!, 'sample.ts', 10);
    assert.ok(history.length >= 2);

    const snapshot = await adapter.getSnapshot(repo!, 'sample.ts', fixture.revisions[0]);
    assert.match(Buffer.from(snapshot).toString('utf8'), /value = 1/);

    const blame = await adapter.getBlame(repo!, 'sample.ts', fixture.revisions[1]);
    assert.ok(blame.length >= 2);

    output.dispose();
    try {
      await fs.rm(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    } catch {
      // Best-effort cleanup only.
    }
  });
});
