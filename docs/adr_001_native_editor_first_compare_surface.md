# ADR 001: Native Editor First Compare Surface

Date: 2026-03-15

## Status

Accepted.

## Context

Fukusa needs to compare historical revisions while preserving the editor features that VS Code already provides well:

- syntax highlighting
- language features such as hover, definition, and references
- theme and cursor behavior
- selection and focus handling

A webview-only surface would have required rebuilding those behaviors from scratch. The repository already had the data model to drive multiple aligned editors, so the lowest-risk path was to keep the primary compare surface inside native `TextEditor` instances.

## Decision

Use native VS Code editors as the default compare surface.

- each revision is rendered as its own tracked editor
- alignment and scrolling are handled by extension code instead of by a custom canvas or DOM layout
- the session model stays independent from the UI container
- webview UI can be added later as an alternate surface without changing the compare model

## Consequences

- Fukusa keeps the built-in VS Code editor experience on the main path.
- Scroll synchronization and editor-group orchestration become part of the extension logic.
- The architecture remains compatible with a future alternate surface, but it is not required for the first usable version.

