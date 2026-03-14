import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { download, runTests } from '@vscode/test-electron';

async function main(): Promise<void> {
  try {
    delete process.env.ELECTRON_RUN_AS_NODE;
    const grepIndex = process.argv.findIndex((value) => value === '--grep');
    if (grepIndex >= 0 && process.argv[grepIndex + 1]) {
      process.env.MOCHA_GREP = process.argv[grepIndex + 1];
    }

    const extensionDevelopmentPath = await createAliasIfNeeded(path.resolve(__dirname, '../../'));
    const extensionTestsPath = path.resolve(extensionDevelopmentPath, 'out/test/suite/index');
    const cachePath = path.join(os.tmpdir(), 'multidiffviewer-vscode-cache');
    const vscodeExecutablePath = await download({
      cachePath,
      version: '1.96.0',
      platform: 'win32-x64-archive'
    });
    await patchWindowsMutex(vscodeExecutablePath);

    await runTests({
      vscodeExecutablePath,
      extensionDevelopmentPath,
      extensionTestsPath
    });
  } catch (error) {
    console.error('Failed to run tests');
    console.error(error);
    process.exit(1);
  }
}

async function createAliasIfNeeded(extensionDevelopmentPath: string): Promise<string> {
  if (!extensionDevelopmentPath.includes(' ')) {
    return extensionDevelopmentPath;
  }

  const aliasPath = path.join(os.tmpdir(), 'multidiffviewer-ext-test');
  await fs.rm(aliasPath, { recursive: true, force: true });
  await fs.symlink(extensionDevelopmentPath, aliasPath, 'junction');
  return aliasPath;
}

async function patchWindowsMutex(vscodeExecutablePath: string): Promise<void> {
  if (process.platform !== 'win32') {
    return;
  }

  const productJsonPath = path.join(path.dirname(vscodeExecutablePath), 'resources', 'app', 'product.json');
  const product = JSON.parse(await fs.readFile(productJsonPath, 'utf8')) as Record<string, unknown>;
  if (!('win32MutexName' in product)) {
    return;
  }

  delete product.win32MutexName;
  await fs.writeFile(productJsonPath, JSON.stringify(product, undefined, 2), 'utf8');
}

void main();
