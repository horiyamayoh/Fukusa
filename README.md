# Fukusa

Fukusa is a VS Code extension for historical N-way compare. It opens the selected revisions as native VS Code text editors ordered `A | B | C | ...`, keeps the middle revision un-duplicated, and uses alignment metadata only for scroll sync and diff decorations.

## What Changed

- The main compare surface is back to native editors, so syntax highlight, definition jump, hover, font, theme, cursor, and selection all stay in VS Code's standard editor surface.
- Two revisions and N revisions use the same native-editor session model.
- `Open Active Session Pair Diff` remains available as a native `vscode.diff` escape hatch for the focused adjacent pair.
- Historical raw files are materialized under repo-local shadow storage:
  - Git: `<repo>/.fukusa-shadow/`
  - SVN: `<repo>/.fukusa-shadow/`

## Main Commands

| Command | Description |
| --- | --- |
| `Fukusa: Browse Revisions` | Pick 2 or more revisions for the current file or an Explorer file and open a native-editor N-way compare session. |
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
- Scroll sync follows aligned logical rows across the visible native editors.
- Raw historical files live in the shadow workspace and are opened directly as `file` scheme documents.

## Development

```powershell
npm run compile
npm test
npm run lint
npx vsce package --pre-release
```

`npm run compile` clears `out/` first so stale generated tests do not survive refactors.
