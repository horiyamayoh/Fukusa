# ADR 002: Repo-Local Shadow Workspace

Date: 2026-03-15

## Status

Accepted.

## Context

Historical revision inspection needs a place to materialize raw files without mutating the original repository checkout. The compare surface also needs those files to exist on disk so VS Code language features and snapshot fallbacks can work reliably.

## Decision

Materialize revision trees under a repo-local shadow workspace rooted at `.fukusa-shadow/`.

- Git repositories and SVN repositories use the same root layout
- revision trees are written below `.fukusa-shadow/revisions/`
- snapshot and escape-hatch URIs point at the materialized files
- the shadow workspace is managed by extension infrastructure instead of by the user

## Consequences

- Snapshots can be reopened as real files when needed.
- Language-feature fallbacks stay available because the files exist on disk.
- The compare model can treat raw revision data as a persistent repo-local resource instead of an ad hoc temporary file.

