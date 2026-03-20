# CLAUDE.md -- Agent Guide for Fukusa

Fukusa is a VS Code extension for historical N-way diff. The main compare surface stays in native editors, with a single-tab panel surface available as an alternate presentation.

## Project Facts

- Package name: `fukusa`
- Command namespace: `multidiff.*`
- URI schemes: `multidiff://`, `multidiff-session-doc://`, `multidiff-session://`
- Minimum VS Code version: `^1.85.0`
- License: MIT
- Commands in `src/commands/`: 21 files
- Unit tests in `src/test/unit/`: 42 files
- Integration tests in `src/test/integration/`: 3 files

## Build And Test

```bash
npm run compile
npm test
npm run test:unit
npm run test:integration
npm run lint
npm run package:vsix
```

Notes:

- The build uses plain `tsc`; there is no bundler.
- Tests run through `@vscode/test-electron`.
- Unit test suite names start with `Unit:`.
- Integration test suite names start with `Integration:`.
- On Windows, `runTest.ts` works around the Electron mutex by patching the downloaded VS Code bundle.

## Architecture

```
extension.ts                    DI wiring and extension entry point
commands/                       Command handlers and command context helpers
presentation/native/            Native editor compare surface
presentation/compare/           Single-tab webview compare surface
presentation/decorations/       Blame and diff decorations
presentation/views/             Tree views
application/                    Core compare logic
infrastructure/                 Cache, FS, and shadow workspace helpers
adapters/                       Git and SVN adapters
```

Key design rules:

- `NWayCompareSession` is the immutable compare model.
- `SessionViewState` is mutable view state and lives in `SessionService`.
- `CompareSurfaceCoordinator` switches between native and panel surfaces.
- Native and panel surfaces share the same session, alignment, and pair-projection core.

## SessionService Events

`SessionService` emits four events. Use these names exactly:

- `onDidChangeSessions`
- `onDidChangeSessionViewState`
- `onDidChangeSessionProjection`
- `onDidChangeSessionPresentation`

Consumers use those events to refresh tree views, command context keys, native controllers, and the panel surface.

## Important Constants

- `MAX_VISIBLE_REVISIONS = 9` in `src/application/sessionViewport.ts`
- `MATCH_SIMILARITY_THRESHOLD = 0.3` in `src/application/nWayAlignmentEngine.ts`
- `MATCH_LOOKAHEAD = 6` in `src/application/nWayAlignmentEngine.ts`
- `MAX_ALIGNMENT_MATRIX_CELLS = 1_500_000` in `src/application/nWayAlignmentEngine.ts`
- `SCROLL_SYNC_DEBOUNCE_MS = 32` in `src/presentation/native/editorSyncController.ts`
- `SCROLL_SYNC_VERIFY_DELAY_MS = 80` in `src/presentation/native/editorSyncController.ts`
- `SCROLL_SYNC_FEEDBACK_SUPPRESSION_MS = 150` in `src/presentation/native/editorSyncController.ts`

## File Guide

| File | Why it matters |
| --- | --- |
| `src/adapters/common/types.ts` | Shared domain types, 26+ interfaces and aliases |
| `src/application/sessionService.ts` | Central session state, view state, and event source |
| `src/application/nWayAlignmentEngine.ts` | Core N-way alignment algorithm |
| `src/application/comparePairing.ts` | Adjacent / base / all / custom pair projection logic |
| `src/application/sessionViewport.ts` | Visible revision window logic |
| `src/presentation/native/editorSyncController.ts` | Scroll sync between native compare editors |
| `src/presentation/native/nativeCompareSessionController.ts` | Native compare surface lifecycle |
| `src/presentation/compare/panelCompareSessionController.ts` | Single-tab webview surface |
| `src/presentation/compare/compareSurfaceCoordinator.ts` | Surface switching and orchestration |
| `src/commands/shared.ts` | Common command helpers used across command handlers |
| `src/infrastructure/fs/uriFactory.ts` | Session and snapshot URI creation |
| `src/infrastructure/fs/snapshotFsProvider.ts` | Read-only `multidiff:` file system provider |
| `src/infrastructure/fs/alignedSessionDocumentProvider.ts` | Synthetic session document provider |
| `src/infrastructure/cache/persistentCache.ts` | Persistent cache with index repair |
| `src/infrastructure/shadow/shadowWorkspaceService.ts` | Repo-local shadow workspace materialization |

## N-Way Engine

`src/application/nWayAlignmentEngine.ts` is the core algorithm. The current implementation:

- uses `diffLines()` to split replacement blocks from unchanged ones
- scores line pairs with exact match, normalized match, and BiGram Dice similarity
- uses dynamic programming for small replacement blocks
- falls back to a bounded greedy matcher for large blocks
- merges pairwise rows progressively from left to right across revisions

The algorithm is intentionally conservative. It preserves gap rows so the shared row space stays stable across revisions.

## Documentation

| File | Status |
| --- | --- |
| `README.md` | User-facing overview and install entry point |
| `CLAUDE.md` | This file |
| `CHANGELOG.md` | Keep a Changelog format |
| `PUBLISHING.md` | Marketplace publishing checklist |
| `docs/N_WAY_PARITY_AUDIT.md` | Living parity audit and progress tracker |
| `docs/SPEC.md` | Current reverse-engineered specification |
| `docs/USER_GUIDE.md` | End-user guide |
| `docs/archive/Fukusa_design_v0.2.md` | Deprecated archived design document |
| `docs/adr_001_*` to `docs/adr_010_*` | Architecture Decision Records |

## Working Rules

- Prefer small, mechanical changes over broad rewrites.
- Do not revert user changes outside the scope of the task.
- Use `apply_patch` for file edits.
- Keep docs accurate to the current code, not the historical design draft.
