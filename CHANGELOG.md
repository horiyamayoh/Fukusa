# Changelog

All notable changes to this project will be documented in this file.

This project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Placeholder for future changes.

## [0.0.1] - 2026-03-15

### Added

- Read-only historical snapshot documents through the `multidiff:` file system scheme.
- Native two-revision compare on standard VS Code editors.
- N-way compare sessions with adjacent and base pair projections.
- Window shifting for visible revision groups.
- Blame heatmap decorations, overview ruler coloring, and hover details.
- Memory cache and persistent cache support for snapshots, history, and blame data.
- Git and SVN repository adapters.
- `tempFile` compatibility fallback for snapshot opening.
- Unit tests, integration tests, and VSIX packaging support.

### Changed

- Initial project rename from MultiDiffViewer to Fukusa.
- The compare surface became native-editor-first.
- The session model introduced aligned synthetic session documents.

### Fixed

- Scroll synchronization now compensates for VS Code sticky scroll padding.
- Snapshot cache reads repair invalid index entries instead of failing hard.

[Unreleased]: https://github.com/horiyamayoh/MultiDiffViewer/compare/v0.0.1...HEAD
[0.0.1]: https://github.com/horiyamayoh/MultiDiffViewer/releases/tag/v0.0.1

