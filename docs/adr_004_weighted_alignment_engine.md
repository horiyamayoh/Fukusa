# ADR 004: Weighted Alignment Engine

Date: 2026-03-19

## Context

The compare surface already works as `A | B | C | ...`, but the old alignment core still had one especially harmful shortcut: when a diff hunk contained removed lines followed by added lines, it paired them by raw offset.

That created unstable N-way output in exactly the cases users notice most:

- an inserted line could be shown as a fake modification of the previous line
- a surviving line could drift downward and break the shared row space
- later UI changes could not solve the issue because the defect lived in the alignment core

## Decision

The alignment logic is now isolated in `src/application/nWayAlignmentEngine.ts`.

Inside that engine:

- the existing progressive N-way merge model is kept, because it already preserves gap rows that matter for `A / missing / C` cases
- replacement hunks no longer pair lines by offset
- replacement hunks are matched with weighted monotonic line matching
- unrelated lines stay as insert/delete rows, while the most similar surviving lines stay aligned

## Consequences

- The current native-editor UI keeps working with the same session model.
- The alignment core is now a separable module instead of ad-hoc logic inside `SessionAlignmentService`.
- We get a concrete quality gain without another full rebuild: inserted lines stop stealing the row of the line that should stay aligned.
