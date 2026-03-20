# ADR 005: Compare Pair Modes

Date: 2026-03-19

## Status

Accepted. Extended by [ADR 007](adr_007_pair_projection_model.md) which adds `all` and `custom` presets.

## Context

Fukusa already had commands named `openSessionAdjacent` and `openSessionBase`, but both opened exactly the same session model.

That meant the product claimed an N-way pair projection concept without actually representing it in the session state. As a result:

- `Base` mode did not exist in practice
- active pair selection was always adjacent-only
- decoration logic assumed pair adjacency even when the user intent was base-oriented comparison

## Decision

Compare pair projection is now part of the session model itself.

- Each session has a `pairProjection`
- visible pair keys are derived from that projection
- active pair selection is projection-aware
- active pair highlighting uses direct pair comparison, not adjacent-only shortcuts

## Consequences

- `Adjacent` and `Base` are now different session behaviors, not just different command names.
- The native editor surface still remains the host, but its compare semantics are more honest to the N-way model.
- Future presets such as `custom` or `all` can be added on top of the same pair calculation layer instead of rewriting the controllers again.
