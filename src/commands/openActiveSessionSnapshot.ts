import { CommandContext } from './commandContext';
import { getSnapshotTargetOrNotify, openSnapshotDocument, SessionSnapshotCommandTarget } from './shared';

export function createOpenActiveSessionSnapshotCommand(
  context: CommandContext
): (target?: SessionSnapshotCommandTarget) => Promise<void> {
  return async (target) => {
    const activeSnapshot = getSnapshotTargetOrNotify(context, target);
    if (!activeSnapshot) {
      return;
    }

    context.sessionService.setActiveRevision(activeSnapshot.session.id, activeSnapshot.snapshot.revisionIndex);
    await openSnapshotDocument(context, activeSnapshot.snapshot);
  };
}
