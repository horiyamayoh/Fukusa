import * as vscode from 'vscode';

export class OutputLogger implements vscode.Disposable {
  private readonly channel: vscode.OutputChannel;

  public constructor(name = 'MultiDiffViewer') {
    this.channel = vscode.window.createOutputChannel(name);
  }

  public info(message: string): void {
    this.append('INFO', message);
  }

  public warn(message: string): void {
    this.append('WARN', message);
  }

  public error(message: string, error?: unknown): void {
    const detail = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error ?? '');
    this.append('ERROR', detail ? `${message}\n${detail}` : message);
  }

  public show(preserveFocus = true): void {
    this.channel.show(preserveFocus);
  }

  public dispose(): void {
    this.channel.dispose();
  }

  private append(level: string, message: string): void {
    const timestamp = new Date().toISOString();
    this.channel.appendLine(`[${timestamp}] [${level}] ${message}`);
  }
}
