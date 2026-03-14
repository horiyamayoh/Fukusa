import * as assert from 'assert';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

import { PersistentCache } from '../../infrastructure/cache/persistentCache';

suite('Unit: PersistentCache', () => {
  test('drops invalid index entries during initialization', async () => {
    const storageDir = await fs.mkdtemp(path.join(os.tmpdir(), 'multidiff-persistent-cache-'));
    const cacheDir = path.join(storageDir, 'cache');
    await fs.mkdir(cacheDir, { recursive: true });
    await fs.writeFile(path.join(cacheDir, 'index.json'), JSON.stringify({
      bad: {
        kind: 'json',
        metadata: {
          key: 'bad',
          namespace: 'blame',
          repoId: 'git:repo123',
          relativePath: 'src/sample.ts',
          size: 1,
          updatedAt: Date.now()
        },
        fileName: '../escape.json'
      }
    }), 'utf8');

    const cache = new PersistentCache(vscode.Uri.file(storageDir));
    const entry = await cache.get('bad');
    assert.strictEqual(entry, undefined);

    const sanitized = JSON.parse(await fs.readFile(path.join(cacheDir, 'index.json'), 'utf8')) as Record<string, unknown>;
    assert.deepStrictEqual(sanitized, {});

    await fs.rm(storageDir, { recursive: true, force: true });
  });
});
