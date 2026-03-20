# Fukusa

Fukusa is a VS Code extension for historical N-way compare. It opens the selected revisions as aligned readonly session documents ordered `A | B | C | ...`, keeps every visible column in the same global row space, and uses raw snapshots only for escape-hatch inspection.

## What Changed

- The main compare surface is still a standard VS Code text editor, but its content now comes from aligned synthetic session documents instead of raw shadow files.
- Two revisions and N revisions use the same native-editor session model.
- A single-tab compare panel is now available as an alternative compare surface when you want one scroll container and all revisions in one place.
- For 3 or more revisions, Fukusa lets you choose how pairs are projected inside the N-way session:
  - `Adjacent`: `A-B`, `B-C`, `C-D`, ...
  - `Base`: leftmost visible column against each visible revision
  - `All`: every visible pair, `A-B`, `A-C`, `B-C`, ...
  - `Custom`: an explicit pair list chosen from the selected revisions
- `Open Active Session Pair Diff` remains available as a native `vscode.diff` escape hatch for the focused pair.
- Historical raw files are materialized under repo-local shadow storage:
  - Git: `<repo>/.fukusa-shadow/`
  - SVN: `<repo>/.fukusa-shadow/`

## Main Commands

| Command | Description |
| --- | --- |
| `Fukusa: Browse Revisions` | Pick 2 or more revisions for the current file or an Explorer file and open a native-editor N-way compare session. |
| `Fukusa: Browse Revisions (Single-Tab)` | Pick revisions for the current file or an Explorer file and open the N-way compare inside one webview panel with a single scroll surface. |
| `Fukusa: Change Pair Projection` | Switch the active session between `Adjacent`, `Base`, `All`, or `Custom` pair projection without rebuilding the session. |
| `Fukusa: Switch Compare Surface` | Move the active session between native editors and the single-tab panel without rebuilding the compare model. |
| `Fukusa: Close Active Session` | Close every tab that belongs to the active Fukusa session at once. |
| `Fukusa: Expand All Collapsed Gaps` | Expand every currently collapsed unchanged gap in the active session. |
| `Fukusa: Open Active Session Snapshot` | Open the focused historical revision using the configured snapshot open mode. |
| `Fukusa: Open Active Session Pair Diff` | Open a native two-way diff for the focused pair. |
| `Fukusa: Reset Expanded Gaps` | Collapse any gaps that were manually reopened while `Collapse Unchanged` is active. |
| `Fukusa: Shift Window Left` | Shift the visible 9-column window left when a session has more than 9 revisions. |
| `Fukusa: Shift Window Right` | Shift the visible 9-column window right when a session has more than 9 revisions. |
| `Fukusa: Toggle Collapse Unchanged` | Toggle the shared row projection for the active session. |
| `Fukusa: Toggle Blame Heatmap` | Toggle line-age heatmap decorations. |
| `Fukusa: Warm Cache for Current File` | Preload recent snapshot history for the current file. |
| `Fukusa: Clear Cache for Current Repository` | Clear cache entries for the current repository. |
| `Fukusa: Clear All Cache` | Clear all Fukusa caches. |

## Settings

| Setting | Description |
| --- | --- |
| `multidiff.blame.mode` | Blame heatmap mode. |
| `multidiff.blame.showOverviewRuler` | Show heatmap colors in the overview ruler. |
| `multidiff.cache.maxSizeMb` | Maximum in-memory cache size. |
| `multidiff.snapshot.openMode` | Open snapshots as virtual `multidiff:` documents or mirrored temporary files. |

## Behavior Notes

- Revision selection is normalized to oldest-to-newest before the session is built.
- When you open 3 or more revisions, Fukusa asks whether the session should use `Adjacent`, `Base`, `All`, or `Custom` pair projection.
- After a session is open, `Change Pair Projection` lets you reproject visible pairs in place instead of rebuilding the compare session.
- `Switch Compare Surface` lets you move the active session between the single-tab panel and native editors while keeping the same revisions, pair projection, and row projection state.
- `Custom...` opens a second picker where you choose the exact revision pairs to project; adjacent pairs are preselected as the starting point.
- `Browse Revisions (Single-Tab)` opens all selected revisions in one panel, so it does not depend on editor-group orchestration or 9-column paging.
- Command palette actions now enable and disable themselves from the active Fukusa session state, so surface-specific or gap-specific actions stop appearing as blind trial-and-error.
- Initial alignment is line-based. Intraline changes are tracked for modified rows.
- Native scroll sync follows the top visible aligned row on a best-effort, line-based basis.
- Inside native `multidiff-session-doc` editors, `Ctrl+Up` and `Ctrl+Down` still use VS Code's native scroll behavior first, then Fukusa immediately syncs the other visible columns to the resulting aligned row.
- Closing any tracked session tab closes the rest of that session's tabs too.
- Visible pair overlays follow the selected pair projection; the focused pair also gets full line and intraline emphasis.
- The single-tab panel keeps all revisions in one scroll container, updates from session view models instead of rebuilding the whole document, and virtualizes rows so larger sessions stay usable.
- `Toggle Collapse Unchanged` now drives one session-level row projection state shared by native editors and the single-tab panel.
- `Expand All Collapsed Gaps` and `Reset Expanded Gaps` work against that shared row projection state, so native editors can reveal or re-collapse unchanged regions without switching to the panel first.
- The single-tab panel can reopen individual collapsed gaps on demand.
- The single-tab panel uses native snapshot / native pair diff as escape hatches.
- The single-tab panel toolbar also exposes `Change Pairs`, so projection changes do not require leaving the panel.
- The single-tab panel toolbar also exposes `Switch Surface`, so you can move the active session back to native editors without reopening it from scratch.
- The single-tab panel toolbar also exposes `Expand All Gaps` and `Reset Gaps`, which call the same commands used by native-editor sessions.
- The sessions tree now shows each session's surface mode, pair projection, and whether unchanged rows are collapsed.
- The sessions tree also exposes direct session actions, so you can reveal, switch surface, or close a specific session without first making it active.
- Snapshot commands respect `multidiff.snapshot.openMode`, so the focused historical revision opens either as a virtual `multidiff:` document or a mirrored temp file.
- Raw historical files still live in the shadow workspace, and pair-diff escape hatches still open those `file` scheme documents directly.

## Development

```powershell
npm run compile
npm test
npm run lint
npx vsce package --pre-release
```

`npm run compile` clears `out/` first so stale generated tests do not survive refactors.
