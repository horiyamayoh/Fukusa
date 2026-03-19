# ADR 010: Session Model vs View State

Date: 2026-03-19

## Context

Fukusa had already split major compare concerns into pure layers:

- alignment
- pair projection
- row projection
- session viewport

But `NWayCompareSession` still mixed immutable compare data with mutable UI state:

- `activeRevisionIndex`
- `activePairKey`
- `pageStart`

That made the session object itself a moving target, which weakened the new pure-model direction and made future caching or persistence harder.

## Decision

Move mutable compare view state out of `NWayCompareSession` and into `SessionService`.

- `NWayCompareSession` now represents only compare model data
- `SessionViewState` represents focus and paging state
- `SessionService` owns both active-session selection and per-session view-state mutation
- consumers such as the panel model, native controller, and viewport builder read compare model plus view state explicitly

## Consequences

- The compare model is now stable enough to cache and reason about as immutable data.
- View transitions such as focus changes and paging are explicit service operations instead of ad hoc session mutation.
- Future work such as restoring session layout, caching visible overlays, or serializing compare state can treat model and view state separately.
