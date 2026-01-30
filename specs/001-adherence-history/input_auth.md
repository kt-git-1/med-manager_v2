Goal:
Implement ONLY AuthZ guard helpers for feature 001 (no other changes).

Inputs:
- specs/000-domain-policy/spec.md (authz boundary)
- specs/001-adherence-history/spec.md
- specs/001-adherence-history/plan.md
- web-api/tests/integration/*.spec.ts (authorization expectations)

Output:
- web-api/src/middleware/authz.ts (create if missing)

Constraints (NON-NEGOTIABLE):
- Modify/create ONLY `web-api/src/middleware/authz.ts`. No other files.
- No routes/controllers/services/db.
- Provide functions that enforce:
  - Patient: self-only access (patientId must match)
  - Family: must have active link to target patient
  - Unlinked: deny access including past data
- Expose an error type or helpers so caller can map:
  - AUTHORIZATION_DENIED (403)
  - EXPIRED (401) when auth context missing/invalid (if applicable)
- Keep it framework-agnostic (pure functions). No Fastify hooks in this file.

Type requirements:
- TypeScript.
- Errors should be detectable by `err.code` string.
