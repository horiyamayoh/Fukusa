import { spawnSync } from 'child_process';
import * as path from 'path';

const patterns = [
  '^Integration: GitAdapter',
  '^Integration: SnapshotFsProvider',
  '^Integration: SvnAdapter'
];

for (const pattern of patterns) {
  const result = spawnSync(process.execPath, [path.resolve(__dirname, 'runTest.js'), '--grep', pattern], {
    stdio: 'inherit',
    env: process.env
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
