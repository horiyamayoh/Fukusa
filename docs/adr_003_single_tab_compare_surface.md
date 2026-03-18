# ADR 003: Single-Tab Compare Surface Spike

## Status

Accepted for spike only.

## Context

The current native `TextEditor` session keeps syntax and language features, but it still has structural limits:

- vertical scroll sync can only approximate alignment
- each revision is a separate tab, so close/reopen has to be orchestrated
- horizontal scroll cannot be synchronized through the public VS Code text editor API

These limits are API-shape problems, not just controller bugs.

## Decision

Keep the production path on native editors for now, but preserve a thin prototype for a future single-tab compare surface.

- The spike entry point is [`prototypeComparePanel.ts`](../src/presentation/compare/prototypeComparePanel.ts).
- The prototype uses one webview panel to render `A | B | C` columns with a single scroll container.
- Native snapshot open and adjacent pair diff stay as escape hatches instead of being reimplemented inside the panel.

## Consequences

- Phase 1 can improve the existing experience without blocking on a larger rewrite.
- Phase 2 has a concrete starting point for validating a single-tab compare surface.
- The spike is intentionally not wired into the command surface yet, so it does not change current user behavior.
