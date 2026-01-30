Goal:
Implement ONLY the cursor helper for feature 001 history pagination.

Inputs:
- specs/001-adherence-history/spec.md
- specs/001-adherence-history/plan.md
- specs/001-adherence-history/contracts/openapi.yaml
- web-api/tests/integration/adherence_history.spec.ts (cursor mismatch expectations)

Output:
- web-api/src/lib/cursor.ts (create if missing)

Constraints (NON-NEGOTIABLE):
- Modify/create ONLY `web-api/src/lib/cursor.ts`. No other files.
- No routes/controllers/services/db changes.
- Cursor must be opaque (base64url-encoded JSON).
- Cursor must bind to the request context:
  - patientId
  - from (YYYY-MM-DD)
  - to (YYYY-MM-DD)
  - lastSeenScheduledAt (ISO string)
  - lastSeenId (string)  // tiebreaker for stable ordering
- Sorting assumptions for history:
  - ORDER BY scheduledAt DESC, adherenceEventId DESC
- Provide exports:
  - `encodeHistoryCursor(args)`
  - `decodeAndValidateHistoryCursor(cursor, expectedCtx)`
- Validation rules:
  - Malformed/invalid base64/json/missing fields => throw Error with code "INVALID_CURSOR"
  - patientId mismatch => "INVALID_CURSOR"
  - from/to mismatch => "INVALID_CURSOR"
- Include small helper: `base64UrlEncode` / `base64UrlDecode` (no external deps)
- Add comments explaining security rationale (prevent cursor reuse across patients/ranges).

Type requirements:
- Use TypeScript.
- Export a typed Error class or function that sets `.code = "INVALID_CURSOR"`.

Done criteria:
- A caller can catch invalid cursor by checking `err.code === "INVALID_CURSOR"`.
