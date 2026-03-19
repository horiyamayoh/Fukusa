import * as vscode from 'vscode';

import { SessionService } from '../../application/sessionService';
import { OutputLogger } from '../../util/output';
import { UriFactory } from './uriFactory';

export class AlignedSessionDocumentProvider implements vscode.TextDocumentContentProvider {
  public constructor(
    private readonly sessionService: SessionService,
    private readonly uriFactory: UriFactory,
    private readonly output: OutputLogger
  ) {}

  public provideTextDocumentContent(uri: vscode.Uri): string {
    const parsed = this.uriFactory.parseSessionDocumentUri(uri);
    const session = this.sessionService.getBrowserSession(parsed.sessionId);
    if (!session) {
      throw new Error(`Session document is not available because session ${parsed.sessionId} no longer exists.`);
    }

    const snapshot = session.rawSnapshots[parsed.revisionIndex];
    if (!snapshot) {
      throw new Error(`Session document revision ${parsed.revisionIndex} is out of range for session ${parsed.sessionId}.`);
    }

    if (snapshot.relativePath !== parsed.relativePath) {
      this.output.warn(`Session document path mismatch for ${uri.toString()}; rendering ${snapshot.relativePath} from the active session.`);
    }

    const binding = this.sessionService.getSessionFileBinding(uri);
    const renderedRowNumbers = binding?.lineNumberSpace === 'globalRow' && binding.projectedGlobalRows && binding.projectedGlobalRows.length > 0
      ? binding.projectedGlobalRows
      : session.globalRows.map((row) => row.rowNumber);

    return renderedRowNumbers
      .map((rowNumber) => {
        const row = session.globalRows[rowNumber - 1];
        const cell = row?.cells[parsed.revisionIndex];
        return cell?.present ? cell.text : '';
      })
      .join('\n');
  }
}
