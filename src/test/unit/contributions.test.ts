import * as assert from 'assert';
import * as path from 'path';

suite('Unit: package contributions', () => {
  test('exposes the streamlined command and view surface', async () => {
    const packageJson = await import(path.resolve(__dirname, '../../../package.json'));
    const commands = (packageJson.default?.contributes?.commands ?? packageJson.contributes?.commands) as Array<{ command: string }>;
    const views = (packageJson.default?.contributes?.views ?? packageJson.contributes?.views) as {
      explorer: Array<{ id: string }>;
    };
    const configuration = (packageJson.default?.contributes?.configuration ?? packageJson.contributes?.configuration) as {
      properties: Record<string, unknown>;
    };

    assert.ok(commands.some((entry) => entry.command === 'multidiff.browseRevisions'));
    assert.ok(commands.some((entry) => entry.command === 'multidiff.closeActiveSession'));
    assert.ok(commands.some((entry) => entry.command === 'multidiff.openActiveSessionSnapshot'));
    assert.ok(commands.some((entry) => entry.command === 'multidiff.openActiveSessionPairDiff'));
    assert.ok(!commands.some((entry) => entry.command === 'multidiff.openForCurrentFile'));
    assert.ok(!commands.some((entry) => entry.command === 'multidiff.openRevisionSnapshot'));
    assert.ok(!commands.some((entry) => entry.command === 'multidiff.compatibility.openSnapshotAsTempFile'));
    assert.deepStrictEqual(views.explorer.map((entry) => entry.id), ['multidiff.sessions', 'multidiff.cache']);
    assert.ok(!('multidiff.compatibility.definitionFallback' in configuration.properties));
    assert.ok(!('multidiff.native.visiblePaneCount' in configuration.properties));
    assert.ok(!('multidiff.native.maxVisiblePaneCount' in configuration.properties));
    assert.ok(!('multidiff.snapshot.openMode' in configuration.properties));
  });
});
