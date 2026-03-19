# ADR 006: Single-Tab Panel Surface

Date: 2026-03-19

## Context

The native-editor session remains useful, but it still inherits hard platform limits:

- multiple editor groups must be orchestrated as one compare surface
- horizontal navigation and column count are constrained by editor-group behavior
- session lifecycle is coupled to tab lifecycle

The repository already had a prototype webview compare panel, but it was intentionally disconnected from the actual command surface.

## Decision

Introduce a production path for a single-tab compare surface.

- Sessions now carry a `surfaceMode`
- `CompareSurfaceCoordinator` selects native or panel presentation per session
- `Browse Revisions (Single-Tab)` opens an N-way session in one webview panel
- The panel is powered by the same session/alignment/pairing core as the native surface
- Native snapshot open and native pair diff remain escape hatches instead of being replaced

## Consequences

- Fukusa now has a real migration path away from multi-editor orchestration.
- The panel surface and the native surface share the same compare model, so improvements in alignment and pair projection apply to both.
- The panel now uses a static webview shell plus message-driven view-model updates, so session refresh does not require rebuilding the whole document.
- Row virtualization is part of the panel surface baseline, which keeps the single-tab path viable as row count grows.
- Collapse-unchanged now sits on top of a dedicated row projection layer instead of being baked directly into panel rendering.
- Future work such as reusable collapse presets or native-surface row projection can be added without another architectural reset.
