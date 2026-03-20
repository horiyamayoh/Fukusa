# Fukusa User Guide

## Quick Start

1. Open a file inside a Git or SVN working copy.
2. Run `Fukusa: Browse Revisions` or `Fukusa: Browse Revisions (Single-Tab)`.
3. Pick 2 or more revisions.
4. If you picked 3 or more revisions, choose a pair projection: `Adjacent`, `Base`, `All`, or `Custom`.
5. Fukusa opens the selected revisions as aligned compare documents ordered from oldest to newest.

## Command Palette

Open the command palette with `Ctrl+Shift+P` on Windows and Linux, or `Cmd+Shift+P` on macOS.

Useful commands:

- `Fukusa: Browse Revisions`
- `Fukusa: Browse Revisions (Single-Tab)`
- `Fukusa: Change Pair Projection`
- `Fukusa: Switch Compare Surface`
- `Fukusa: Toggle Collapse Unchanged`
- `Fukusa: Expand All Collapsed Gaps`
- `Fukusa: Reset Expanded Gaps`
- `Fukusa: Open Active Session Snapshot`
- `Fukusa: Open Active Session Pair Diff`
- `Fukusa: Close Active Session`

Some internal commands are hidden from the palette and are used by the extension itself.

## Keyboard Shortcuts

- `Ctrl+Up` and `Ctrl+Down` scroll the active aligned editor while keeping the other visible compare columns in sync.
- These shortcuts only apply inside `multidiff-session-doc` editors.
- Native editor scroll sync is line-based and best-effort for mouse wheel, trackpad, and scrollbar movement.

## Reading a Session

- Each column is one revision of the same logical file.
- The active revision is the focused editor.
- `Adjacent` mode compares each visible revision with its visible neighbor.
- `Base` mode compares the leftmost visible revision with every other visible revision.
- `All` mode compares every visible pair inside the current window.
- `Custom` mode compares only the explicit revision pairs selected during session creation.
- `Open Active Session Snapshot` respects `multidiff.snapshot.openMode`.
- `Open Active Session Pair Diff` uses the focused pair.
- `Change Pair Projection` updates the active session without reopening it.
- `Switch Compare Surface` moves the active session between native editors and the single-tab panel.

## Settings

- `multidiff.blame.mode`: blame heatmap mode. The current implementation uses `age`.
- `multidiff.blame.showOverviewRuler`: enables blame colors in the overview ruler.
- `multidiff.cache.maxSizeMb`: limits in-memory cache size in MiB.
- `multidiff.snapshot.openMode`: chooses virtual `multidiff:` documents or mirrored temp files.

## Single-Tab Panel

- `Fukusa: Browse Revisions (Single-Tab)` opens the compare surface in one webview panel.
- The panel uses one scroll container for all selected revisions.
- Panel updates are pushed as view-model changes, so refreshing the session does not rebuild the whole webview.
- `Collapse Unchanged`, `Expand All Collapsed Gaps`, and `Reset Expanded Gaps` work in both native editors and the panel.

## Troubleshooting

- If no repository is detected, make sure the file is inside a Git or SVN working copy.
- If the extension cannot read revisions, verify that Git CLI or SVN CLI is installed and available on `PATH`.
- If the session opens but snapshots fail, check `multidiff.snapshot.openMode` and try `tempFile` for compatibility-sensitive tools.
- If scroll sync feels slightly off in native editors, use the single-tab panel for an exact single-scroll-container view.
- If the compare surface looks stale, close the session and open it again from the command palette.

