# Research: 001 Adherence History (MVP)

## Decision 1: Contract artifacts location
- Decision: Store feature contracts in `specs/001-adherence-history/contracts/`.
- Rationale: Constitution allows feature-scoped contracts; keeps spec/plan/contracts aligned for this feature.
- Alternatives considered: Centralize under `web-api/contracts/` to share across features.

## Decision 2: Cursor pagination strategy
- Decision: Opaque cursor bound to patientId + sort order + from/to range.
- Rationale: Prevents data leakage and supports stable paging under concurrent inserts.
- Alternatives considered: Offset-based pagination; rejected due to unstable ordering.

## Decision 3: Same dose key and uniqueness
- Decision: same dose key = (patientId, medicationId, scheduledAt), enforce unique TAKEN constraint.
- Rationale: scheduledAt is the immutable computed time used for display; ensures deduplication across retries.
- Alternatives considered: (scheduleId, date); rejected because schedule can change and may not map cleanly across edits.
