Use:
- specs/001-adherence-history/spec.md
- specs/001-adherence-history/plan.md
Output:
- specs/001-adherence-history/tasks.md

Rules (must follow constitution):
- Tasks ordered strictly: Tests -> Implementation -> Verification
- Every task includes: file paths + done conditions
- Web API: at minimum contract + integration tests
- iOS: at minimum build verification + primary user-flow checks via quickstart
- Include exception paths in tests: authz denied, not found, expired, duplicate, limit exceeded, invalid cursor, network loss (as client handling note), race/idempotency
- Include explicit contracts artifacts under specs/001-adherence-history/contracts/ (OpenAPI or md/json schema is fine)

Deliver tasks across modules:
- web-api: endpoints POST /adherence/taken, GET /adherence/today, GET /adherence/history
- web-api: authZ (patientSessionToken vs family token; unlink denies past)
- web-api: uniqueness (same dose key) + idempotency ((recordedByUserId, idempotencyKey))
- web-api: cursor binding (patientId + from/to + lastSeen)
- ios-patient: link code -> patientSessionToken flow; create TAKEN; today UI day view + month marks (minimal)
- ios-family: login; select patient; create TAKEN; today/history UI minimal
- quickstart.md: seed/login/steps/expected results/evidence
