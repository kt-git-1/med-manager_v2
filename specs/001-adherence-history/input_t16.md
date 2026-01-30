Goal:
Implement ONLY POST /api/adherence/taken endpoint for feature 001 so integration tests for taken (patient/family) can pass.

Inputs:
- specs/001-adherence-history/spec.md
- specs/001-adherence-history/plan.md
- specs/001-adherence-history/contracts/openapi.yaml
- web-api/src/db/queries/adherence_queries.ts
- web-api/src/middleware/authz.ts
- web-api/tests/integration/adherence_taken.patient.spec.ts
- web-api/tests/integration/adherence_taken.family.spec.ts

Allowed output files (ONLY):
- web-api/src/routes/adherence.ts   (create)
- web-api/src/app.ts               (modify only to register the route)

Constraints (NON-NEGOTIABLE):
- Do NOT touch any other files.
- Do NOT implement /today or /history yet.
- Route path must match OpenAPI: POST /api/adherence/taken
- Require header: Idempotency-Key (missing -> 400 INVALID_ARGUMENT)
- Auth headers (as assumed by tests):
  - patient: X-Patient-Session
  - family: Authorization: Bearer ...
- Use in-memory queries via createAdherenceQueries() from adherence_queries.ts (or instantiate InMemoryAdherenceQueries).
- Use authz helpers from authz.ts to enforce:
  - patient self-only
  - family must be linked (active) to targetPatientId
  - unlink denies
- Temporary auth/link resolution is OK (to satisfy tests) but must be isolated and clearly marked:
  - "ps_patient_001" -> patientId "patient_001"
  - "Bearer family_token_123" -> familyUserId "family_123" with active link to patient_001
  - "Bearer family_unlinked" -> familyUserId "family_unlinked" with unlinked/missing link to patient_001
- Medication existence stub is OK:
  - accept medicationId "med_001" (others -> 404 NOT_FOUND)
- Error response format must match OpenAPI:
  { "error_code": string, "message": string, "details"?: object|null }
- Status code mapping:
  - 400: INVALID_ARGUMENT / LIMIT_EXCEEDED / INVALID_CURSOR
  - 401: EXPIRED
  - 403: AUTHORIZATION_DENIED
  - 404: NOT_FOUND
  - 409: DUPLICATE
- No PII logging.

Done criteria:
- `web-api/tests/integration/adherence_taken.patient.spec.ts` passes
- `web-api/tests/integration/adherence_taken.family.spec.ts` passes
