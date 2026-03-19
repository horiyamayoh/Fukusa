# ADR 008: Row Projection Layer

Date: 2026-03-19

## Context

Alignment gives Fukusa one global row space, but the product still lacked a distinct layer for deciding which rows should actually be shown.

That caused two problems:

- the panel surface always had to render the full aligned row set
- features such as collapse-unchanged risked being implemented as ad hoc UI logic instead of reusable compare behavior

## Decision

Introduce a row projection layer between aligned rows and rendered rows.

- `compareRowProjection.ts` projects visible rows from changed-row sets
- the first projection feature is collapse-unchanged with context lines and expandable gaps
- session projection state now lives in `SessionService` so multiple surfaces can share it
- the single-tab panel consumes projected rows instead of raw global rows directly
- native compare documents now render projected row sets and map sync / decorations / blame through projected line maps
- gap expansion remains panel UI state layered on top of the shared projection model

## Consequences

- Collapse-unchanged is now a session/model concern, not a webview-only hack.
- The panel can scale better on long files because it combines row virtualization with row projection.
- Native and panel surfaces now share one row projection pipeline, so future compare features can target projection once and reuse it across both surfaces.
