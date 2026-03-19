# ADR 009: Session Viewport Model

Date: 2026-03-19

## Context

Fukusa now has separate foundations for:

- alignment
- pair projection
- row projection

But the application still rebuilt "what the user is currently looking at" in multiple places.

- `SessionService` derived visible windows and active pairs
- the panel rebuilt visible pairs and row projection again
- native controllers rebuilt projected rows and line maps again
- decoration code recomputed visible pairs separately

That duplication risks semantic drift whenever paging, active-pair rules, or collapse behavior changes.

## Decision

Introduce `sessionViewport.ts` as the pure model builder for the current session view.

- `getSessionVisibleWindow()` owns page/window semantics
- `getSessionActivePair()` owns focus-driven active-pair resolution inside the visible window
- `buildSessionViewport()` combines visible window, visible pairs, row projection, and document-line projection for line-based surfaces

`SessionService`, native compare rendering, diff decorations, and panel document building should consume this model instead of re-deriving equivalent state independently.

## Consequences

- Visible window and active-pair semantics now live in one application-layer model instead of being scattered across controllers.
- Native and panel surfaces share one definition of the current compare viewport.
- Future work such as custom paging, projection caching, or alternate surfaces can extend one model instead of patching several controllers in parallel.
