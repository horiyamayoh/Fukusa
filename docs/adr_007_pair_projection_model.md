# ADR 007: Pair Projection Model

Date: 2026-03-19

## Context

`Adjacent` and `Base` were already represented in the session, but the representation was still too narrow:

- the session only stored a mode enum, not the projection itself
- adding `All` or `Custom` would have required more mode-specific branching across commands, services, and UI
- non-adjacent pair overlays were recomputed repeatedly, which would get worse as visible pair count grew

## Decision

Replace the old pair-mode enum flow with an explicit pair projection model.

- Each session now carries `pairProjection`
- Preset projections are `adjacent`, `base`, and `all`
- `custom` is represented as an explicit ordered list of pair keys
- projection normalization happens during session build
- pair overlay lookup is memoized per session so non-adjacent projections do not rebuild overlays every time

## Consequences

- Pair projection is now a first-class part of the compare model instead of UI state leaking into services.
- `All` projection is available immediately on both native and single-tab surfaces.
- `Custom` pair projection is now exposed through the browse flow as an explicit pair picker.
- Future work can build reusable custom presets on top of the same model without another session-model rewrite.
