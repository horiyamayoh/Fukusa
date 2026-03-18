# Fukusa User Guide

## Basic Flow

1. Open a file inside a Git or SVN working copy.
2. Run `Fukusa: Browse Revisions`.
3. Pick 2 or more revisions.
4. Fukusa opens the selected revisions as aligned compare documents ordered from oldest to newest.

## Reading the Session

- Each column is one revision of the same logical file.
- The active revision is the focused editor.
- The active adjacent pair is focus-driven: focused editor + right neighbor, or left neighbor if the focused editor is the last visible column.
- `Open Active Session Snapshot` uses the focused revision.
- `Open Active Session Pair Diff` uses the focused adjacent pair.
- `Close Active Session` closes all visible tabs that belong to the current session.
- Scroll synchronization treats the top visible aligned row as the source of truth, so any visible compare column can drive the others.
- All visible adjacent pairs show diff edges; the focused pair also gets full line and intraline emphasis.
- `Shift Window Left` and `Shift Window Right` move the visible page only when a session has more than 9 revisions.

## Language Features

- The main compare surface is a standard VS Code text editor backed by aligned session documents.
- Syntax highlighting, definition jump, hover, font, theme, cursor, and selection behavior come from VS Code directly.

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

## Current Limits

- Compare targets are still one logical file across multiple revisions.
- Alignment is line-based in the current implementation.
- Raw shadow trees can be expensive for very large historical revisions because Fukusa materializes full repo content for language-feature accuracy.
