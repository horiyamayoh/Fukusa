import { execFile } from 'child_process';

export interface ExecResult {
  readonly stdout: Buffer;
  readonly stderr: Buffer;
}

export async function execFileBuffered(
  executable: string,
  args: readonly string[],
  cwd?: string
): Promise<ExecResult> {
  return new Promise<ExecResult>((resolve, reject) => {
    execFile(
      executable,
      [...args],
      {
        cwd,
        encoding: 'buffer',
        maxBuffer: 64 * 1024 * 1024,
        windowsHide: true
      },
      (error, stdout, stderr) => {
        if (error) {
          const stderrText = Buffer.isBuffer(stderr) ? stderr.toString('utf8') : String(stderr);
          reject(new Error(`${executable} ${args.join(' ')} failed: ${stderrText.trim()}`));
          return;
        }

        resolve({
          stdout: Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout),
          stderr: Buffer.isBuffer(stderr) ? stderr : Buffer.from(stderr)
        });
      }
    );
  });
}
