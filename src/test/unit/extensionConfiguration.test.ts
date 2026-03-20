import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';

import {
  getBlameShowOverviewRuler,
  getCacheMaxSizeMb,
  getSnapshotOpenMode
} from '../../configuration/extensionConfiguration';

suite('Unit: extensionConfiguration', () => {
  teardown(() => {
    sinon.restore();
  });

  test('reads cache and blame settings from their configured sections', () => {
    sinon.stub(vscode.workspace, 'getConfiguration').callsFake(((section?: string) => ({
      get<T>(setting: string, defaultValue?: T): T | undefined {
        if (section === 'multidiff.cache' && setting === 'maxSizeMb') {
          return 256 as T;
        }

        if (section === 'multidiff' && setting === 'blame.showOverviewRuler') {
          return false as T;
        }

        return defaultValue;
      }
    })) as typeof vscode.workspace.getConfiguration);

    assert.strictEqual(getCacheMaxSizeMb(), 256);
    assert.strictEqual(getBlameShowOverviewRuler(), false);
  });

  test('falls back to the default snapshot open mode when configuration is invalid', () => {
    sinon.stub(vscode.workspace, 'getConfiguration').callsFake(((section?: string) => ({
      get<T>(setting: string, defaultValue?: T): T | undefined {
        if (section === 'multidiff' && setting === 'snapshot.openMode') {
          return 'unexpected' as T;
        }

        return defaultValue;
      }
    })) as typeof vscode.workspace.getConfiguration);

    assert.strictEqual(getSnapshotOpenMode(), 'virtual');
  });
});
