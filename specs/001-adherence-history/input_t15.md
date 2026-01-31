Goal:
Implement ONLY the adherence repository queries for feature 001.

Inputs:
- specs/001-adherence-history/spec.md
- specs/001-adherence-history/plan.md
- specs/001-adherence-history/contracts/openapi.yaml
- web-api/src/lib/cursor.ts
- web-api/src/middleware/authz.ts
- web-api/tests/integration/adherence_taken.patient.spec.ts
- web-api/tests/integration/adherence_taken.family.spec.ts
- web-api/tests/integration/adherence_today.spec.ts
- web-api/tests/integration/adherence_history.spec.ts

Output:
- web-api/src/db/queries/adherence_queries.ts (create if missing)

Constraints (NON-NEGOTIABLE):
- Modify/create ONLY `web-api/src/db/queries/adherence_queries.ts`. No other files.
- Do NOT implement routes/controllers/services.
- Do NOT add migrations/schema files.
- Keep implementation in-memory/mock-friendly for now:
  - Provide a Query interface and a default in-memory implementation (simple Map/Array) inside this file.
  - This is temporary to allow integration tests to run without a DB.
- Must support operations needed by Feature 001:
  1) createTakenEvent(args) with idempotencyKey
     - enforce same dose key uniqueness (patientId, medicationId, scheduledAt) for TAKEN
     - if same idempotencyKey replay => return same event
     - if same dose but different idempotencyKey => throw error code "DUPLICATE"
  2) listTodayDosesWithEvents(args)
     - return doses[] sorted by scheduledAt ASC
     - each dose includes optional event (0/1) for that (patientId, medicationId, scheduledAt)
     - monthMarks[] returned as derived marks from events in that month (date -> hasEvents)
     - schedule (doses) can be mocked with a deterministic rule inside this file
  3) listHistoryEvents(args)
     - from/to inclusive (in patient TZ already resolved by caller)
     - ordering: scheduledAt DESC then adherenceEventId DESC
     - pagination: limit + cursor (uses decodeAndValidateHistoryCursor)
     - nextCursor generated from last item or null
- Errors:
  - use `code` strings compatible with controllers:
    - "NOT_FOUND", "DUPLICATE", "INVALID_ARGUMENT", "LIMIT_EXCEEDED"
- Types:
  - Define TypeScript types matching openapi schemas (AdherenceEvent, Dose, MonthMark)
- Add comments: this is a temporary in-memory repo to unblock tests; will be replaced by DB later.

Done criteria:
- A caller can use this repository to satisfy integration tests without real DB.
