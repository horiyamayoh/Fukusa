# Fukusa User Guide

## Basic Flow

1. Open a file inside a Git or SVN working copy.
2. Run `Fukusa: Browse Revisions` or `Fukusa: Browse Revisions (Single-Tab)`.
3. Pick 2 or more revisions.
4. If you picked 3 or more revisions, choose `Adjacent`, `Base`, `All`, or `Custom` pair projection.
5. Fukusa opens the selected revisions as aligned compare documents ordered from oldest to newest.

## Reading the Session

- Each column is one revision of the same logical file.
- The active revision is the focused editor.
- In `Adjacent` mode, the active pair is focus-driven: focused editor + right neighbor, or left neighbor if the focused editor is the last visible column.
- In `Base` mode, the active pair is `leftmost visible revision + focused revision`.
- In `All` mode, the active pair is the nearest visible pair that contains the focused revision, with the right-side neighbor winning ties.
- In `Custom` mode, the active pair is the nearest visible selected pair that contains the focused revision, with the right-side neighbor winning ties.
- `Open Active Session Snapshot` uses the focused revision and respects `multidiff.snapshot.openMode`.
- `Open Active Session Pair Diff` uses the focused pair.
- `Change Pair Projection` updates the active session's visible pair model without reopening the session.
- `Switch Compare Surface` moves the active session between native editors and the single-tab panel without rebuilding the session.
- Command palette actions enable or disable themselves from the active session state, so window-shift and gap commands are only available when the current session can actually use them.
- `Close Active Session` closes all visible tabs that belong to the current session.
- `Toggle Collapse Unchanged` switches the active session between full rows and projected rows.
- `Expand All Collapsed Gaps` reveals every currently collapsed unchanged region in the active session.
- `Reset Expanded Gaps` reapplies the collapsed view after you manually reopened gaps.
- Scroll synchronization treats the top visible aligned row as the source of truth, so any visible compare column can drive the others.
- Native editor scroll sync is still best-effort and line-based for mouse wheel, scrollbar drag, and touchpad scrolling because VS Code only exposes visible-range changes, not exact pixel offsets.
- Inside native compare documents, `Ctrl+Up` and `Ctrl+Down` keep VS Code's native scroll behavior, and Fukusa immediately synchronizes the other visible columns from the resulting top aligned row.
- All visible projected pairs show diff edges; the focused pair also gets full line and intraline emphasis.
- `Shift Window Left` and `Shift Window Right` move the visible page only when a session has more than 9 revisions.

## Compare Modes

- `Adjacent`: compare each visible revision against its visible neighbor.
- `Base`: compare the leftmost visible revision against every other visible revision.
- `All`: compare every visible pair inside the current window.
- `Custom`: compare only the explicit pair list you selected during session creation.
- `Fukusa: Change Pair Projection` lets you switch between these modes after the session is already open.
- When you shift the visible window in `Base` mode, the base column becomes the new leftmost visible revision.
- `Custom...` opens a second picker that lists every revision pair and preselects the adjacent pairs as a starting point.
  When the current session already uses `Custom`, Fukusa preselects the existing custom pair list so you can edit it instead of rebuilding it.

## Single-Tab Panel

- `Fukusa: Browse Revisions (Single-Tab)` opens the compare surface in one webview panel instead of multiple editor groups, and it is available from the Explorer context menu for file resources.
- The panel shows all selected revisions in one scroll container.
- Panel updates are pushed as compare view models, so refreshing the session does not rebuild the whole webview document.
- Rows are virtualized inside the panel, which keeps larger aligned sessions responsive.
- `Collapse Unchanged` in the panel and `Fukusa: Toggle Collapse Unchanged` in the command palette both change the same session-level row projection state.
- `Fukusa: Expand All Collapsed Gaps` and `Fukusa: Reset Expanded Gaps` work in both native editors and the panel, so row projection can be controlled without changing surfaces.
- `Change Pairs` in the panel toolbar opens the same pair-projection picker as `Fukusa: Change Pair Projection`.
- `Switch Surface` in the panel toolbar opens the same surface switcher as `Fukusa: Switch Compare Surface`.
- `Expand All Gaps` and `Reset Gaps` in the panel toolbar call those same shared commands.
- The panel lets you reopen individual gaps inline; native editors still do not expose per-gap inline buttons.
- Column header clicks change the active revision.
- Pair buttons switch the active pair according to the current pair projection.
- `Native Pair Diff` and `Snapshot` actions remain available from inside the panel.

## Sessions Tree

- The `Fukusa Sessions` view lists every open compare session and its raw snapshots.
- Session rows expose context actions to reveal the session, switch its surface, or close that specific session directly from the tree.
- Snapshot rows still open the raw historical file.

## Language Features

- The main compare surface is a standard VS Code text editor backed by aligned session documents.
- Syntax highlighting, font, theme, cursor, and selection behavior come from VS Code directly.
- Definition jump, hover, and references on aligned session documents remain best-effort and depend on whether the installed language extension supports Fukusa's virtual document schemes.
- When you need exact historical language-feature behavior from a real file path, use the snapshot escape hatch with `multidiff.snapshot.openMode = tempFile`.

## Shadow Workspace Layout

- Git: `<repo>/.fukusa-shadow/`
- SVN: `<repo>/.fukusa-shadow/`

Inside that root:

- `revisions/<revision>/...` stores raw historical trees.

## Blame Heatmap

- `Fukusa: Toggle Blame Heatmap` overlays age buckets on the active editor.
- In compare workflows, blame is applied directly to the visible native editors.

## Configuration

- `multidiff.blame.showOverviewRuler`: toggle overview ruler coloring.
- `multidiff.cache.maxSizeMb`: cache size limit.
- `multidiff.snapshot.openMode`: choose whether session, tree, and panel snapshot opens use virtual `multidiff:` documents or mirrored temp files.

## Current Limits

- Compare targets are still one logical file across multiple revisions.
- Alignment is line-based in the current implementation.
- Native editor scroll sync is not pixel-exact. If you need one exact scroll surface across many revisions, use `Browse Revisions (Single-Tab)`.
- Raw shadow trees can be expensive for very large historical revisions because Fukusa materializes full repo content for language-feature accuracy.
