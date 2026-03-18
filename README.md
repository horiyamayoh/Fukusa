# Fukusa

Fukusa is a VS Code extension for historical N-way compare. It opens the selected revisions as aligned readonly session documents ordered `A | B | C | ...`, keeps every visible column in the same global row space, and uses raw snapshots only for escape-hatch inspection.

## What Changed

- The main compare surface is still a standard VS Code text editor, but its content now comes from aligned synthetic session documents instead of raw shadow files.
- Two revisions and N revisions use the same native-editor session model.
- `Open Active Session Pair Diff` remains available as a native `vscode.diff` escape hatch for the focused adjacent pair.
- Historical raw files are materialized under repo-local shadow storage:
  - Git: `<repo>/.fukusa-shadow/`
  - SVN: `<repo>/.fukusa-shadow/`

## Main Commands

| Command | Description |
| --- | --- |
| `Fukusa: Browse Revisions` | Pick 2 or more revisions for the current file or an Explorer file and open a native-editor N-way compare session. |
| `Fukusa: Close Active Session` | Close every tab that belongs to the active Fukusa session at once. |
| `Fukusa: Open Active Session Snapshot` | Open the raw historical file for the focused revision. |
| `Fukusa: Open Active Session Pair Diff` | Open a native two-way diff for the focused adjacent pair. |
| `Fukusa: Shift Window Left` | Shift the visible 9-column window left when a session has more than 9 revisions. |
| `Fukusa: Shift Window Right` | Shift the visible 9-column window right when a session has more than 9 revisions. |
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

## Behavior Notes

- Revision selection is normalized to oldest-to-newest before the session is built.
- Initial alignment is line-based. Intraline changes are tracked for modified rows.
- Scroll sync keeps the top visible aligned row exactly matched across all visible compare columns.
- Closing any tracked session tab closes the rest of that session's tabs too.
- Visible revisions always keep pair-edge diff markers; the focused adjacent pair also gets full line and intraline emphasis.
- Raw historical files still live in the shadow workspace and are opened directly as `file` scheme documents when you use snapshot or pair-diff escape hatches.

## Development

```powershell
npm run compile
npm test
npm run lint
npx vsce package --pre-release
```

`npm run compile` clears `out/` first so stale generated tests do not survive refactors.
