import * as vscode from 'vscode';

export class DisposableStore implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private disposed = false;

  public add<T extends vscode.Disposable>(disposable: T): T {
    if (this.disposed) {
      disposable.dispose();
      throw new Error('DisposableStore is already disposed.');
    }

    this.disposables.push(disposable);
    return disposable;
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    while (this.disposables.length > 0) {
      this.disposables.pop()?.dispose();
    }
  }
}
