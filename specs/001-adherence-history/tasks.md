# Tasks: 001 Adherence History (MVP)

## Rules (Constitution)
- Tasks are ordered strictly: **Contracts/Tests → Implementation → Verification**
- Every task includes: **file paths** + **done conditions**
- Web API: minimum **contract tests + integration tests**
- iOS: minimum **build verification + primary user-flow check via quickstart**
- Exception paths MUST be covered in tests:
  - AUTHZ denied / NOT_FOUND / EXPIRED / DUPLICATE / LIMIT_EXCEEDED / INVALID_CURSOR / INVALID_ARGUMENT
  - Retry/Idempotency / Concurrency-Race
  - Network loss: iOS side UX (manual verification) as MVP (no offline queue)

---

## Phase 1: Contracts & Tests (REQUIRED FIRST)

### 1.1 Contract artifacts
- [ ] T001 Create/update OpenAPI contract  
  - Files:
    - `specs/001-adherence-history/contracts/openapi.yaml`
  - Done:
    - [ ] Defines endpoints: `POST /adherence/taken`, `GET /adherence/today`, `GET /adherence/history`
    - [ ] Defines error format: `{ error_code, message, details? }`
    - [ ] Includes: `Idempotency-Key` header (required for POST)
    - [ ] Includes pagination: `cursor`, `limit (default 50, max 200)`, `nextCursor`
    - [ ] Includes today response shape (dose primary): `doses[]` + `doseKey` + `event(0/1)`
    - [ ] Includes history sort + cursor binding semantics (scheduledAt DESC + id DESC)

### 1.2 Web-api test scaffolding (tests only)
- [x] T002 Add/confirm test scaffolding for contract/integration tests  
  - Files:
    - `web-api/tests/contract/*`
    - `web-api/tests/integration/*`
    - `web-api/tests/helpers/*` (if needed)
  - Done:
    - [ ] test runner discovers new test files
    - [ ] can run `contract` and `integration` suites separately (tags or folders)

### 1.3 Contract tests (web-api)
- [x] T003 [P] [US1] Contract test: POST /adherence/taken (patient)  
  - Files:
    - `web-api/tests/contract/adherence_taken.patient.spec.ts`
  - Done:
    - [ ] request/response schema matches openapi
    - [ ] sets `recordedBy=patient` and `recordedByUserId=patientId`
    - [ ] `DUPLICATE` on same dose key (different idempotency key)
    - [ ] idempotent replay returns same response (same idempotency key)
    - [ ] `EXPIRED` for expired/invalid patientSessionToken
    - [ ] `INVALID_ARGUMENT` for malformed fields

- [x] T004 [P] [US2] Contract test: POST /adherence/taken (family proxy)  
  - Files:
    - `web-api/tests/contract/adherence_taken.family.spec.ts`
  - Done:
    - [ ] `targetPatientId` required
    - [ ] active link allows
    - [ ] unlink denies (AUTHORIZATION_DENIED)
    - [ ] recordedBy=family + recordedByUserId=familyUserId
    - [ ] duplicate + idempotent replay behavior validated

- [x] T005 [P] [US3] Contract test: GET /adherence/today  
  - Files:
    - `web-api/tests/contract/adherence_today.spec.ts`
  - Done:
    - [ ] returns `doses[]` (primary) each with `doseKey`, `scheduledAt`, `medicationId`, `slot`
    - [ ] each dose has `event` optional (0 or 1), never >1
    - [ ] doses sorted by `scheduledAt ASC`
    - [ ] month marks present (or explicitly optional but then UI must still satisfy US3 via returned monthMarks)
    - [ ] patient self-only / family linked-only
    - [ ] unlink denies

- [x] T006 [P] [US4] Contract test: GET /adherence/history  
  - Files:
    - `web-api/tests/contract/adherence_history.spec.ts`
  - Done:
    - [ ] from/to inclusive semantics
    - [ ] limit default=50, max=200
    - [ ] `LIMIT_EXCEEDED` when limit>200
    - [ ] cursor/nextCursor behavior matches contract
    - [ ] `INVALID_CURSOR` for malformed/mismatched cursor
    - [ ] `INVALID_ARGUMENT` for from>to
    - [ ] AUTHORIZATION_DENIED for boundary violations

### 1.4 Integration tests (web-api)
> ここでは “テストを先に書いて落ちる状態” を作る（実装はPhase 2で入れる）

- [x] T007 [P] [US1] Integration: patient TAKEN end-to-end  
  - Files:
    - `web-api/tests/integration/adherence_taken.patient.spec.ts`
  - Done:
    - [ ] patientSessionTokenでTAKEN作成できる
    - [ ] same dose duplicate rejected
    - [ ] idempotency replay returns same event
    - [ ] created event reflects in `GET /adherence/today`

- [x] T008 [P] [US2] Integration: family proxy TAKEN end-to-end  
  - Files:
    - `web-api/tests/integration/adherence_taken.family.spec.ts`
  - Done:
    - [ ] active link allows TAKEN
    - [ ] unlink denies (past included)
    - [ ] created event reflects in today/history

- [x] T009 [P] [US3] Integration: today schedule+events merge  
  - Files:
    - `web-api/tests/integration/adherence_today.spec.ts`
  - Done:
    - [ ] doses exist (seeded)
    - [ ] dose->event mapping is 0/1
    - [ ] scheduledAt ASC ordering
    - [ ] month marks computed for the month containing requested date

- [x] T010 [P] [US4] Integration: history paging + cursor binding  
  - Files:
    - `web-api/tests/integration/adherence_history.spec.ts`
  - Done:
    - [ ] order is `scheduledAt DESC, id DESC`
    - [ ] cursor binds patientId + from/to + lastSeen
    - [ ] mismatch patientId/range -> INVALID_CURSOR
    - [ ] authz denial after unlink

### 1.5 Dependency check (patient session issuance)
- [ ] T011 Document & verify how patientSessionToken is obtained (dependency)  
  - Files:
    - `specs/001-adherence-history/quickstart.md` (draft section)
    - `web-api/tests/integration/_auth_patient_session.smoke.spec.ts` (optional, if endpoint exists)
  - Done:
    - [ ] Quickstart specifies the exact way to obtain a valid patientSessionToken
    - [ ] If an API exists, add a smoke test that fetches a token successfully
    - [ ] If no API exists, create follow-up feature ticket (outside 001) and clearly state temporary test token method for 001

---

## Phase 2: Implementation (after tests exist)

### 2.1 DB migrations / schema
- [ ] T012 Add DB migrations for dose + adherence_event indexes  
  - Files:
    - `web-api/src/db/migrations/001_adherence_history.sql` (or repo standard migration location)
  - Done:
    - [ ] unique index: `(patientId, medicationId, scheduledAt)` WHERE status='TAKEN'
    - [ ] unique index: `(recordedByUserId, idempotencyKey)` WHERE idempotencyKey IS NOT NULL
    - [ ] index: `(patientId, scheduledAt)` for today queries
    - [ ] index: `(patientId, scheduledAt DESC, id DESC)` for history paging
    - [ ] index: `dose(patientId, scheduledAt)`
    - [ ] migrations run successfully in CI/dev

### 2.2 Cursor helpers
- [ ] T013 Implement cursor encode/decode helpers  
  - Files:
    - `web-api/src/lib/cursor.ts`
  - Done:
    - [ ] cursor encodes: patientId + from/to + lastSeen(scheduledAt,id)
    - [ ] decode validates request patientId/from/to match
    - [ ] invalid/mismatch returns INVALID_CURSOR (mapped at controller)

### 2.3 AuthZ guard
- [ ] T014 Implement AuthZ guard helpers  
  - Files:
    - `web-api/src/middleware/authz.ts`
  - Done:
    - [ ] patientSessionToken → patientId resolved; self-only enforced
    - [ ] family token → active link required
    - [ ] unlinked denies both read and write (past included)
    - [ ] no PII logged

### 2.4 Repository queries
- [ ] T015 Implement adherence repository queries  
  - Files:
    - `web-api/src/db/queries/adherence_queries.ts`
  - Done:
    - [ ] create TAKEN with same-dose uniqueness handling
    - [ ] today query loads doses + matching events
    - [ ] history query supports from/to + (scheduledAt,id) cursor
    - [ ] month marks query: month range → dates with hasEvents

### 2.5 Service layer
- [ ] T016 Implement adherence service logic  
  - Files:
    - `web-api/src/services/adherence_service.ts`
  - Done:
    - [ ] patient flow sets recordedBy/recordedByUserId correctly
    - [ ] family flow sets recordedBy/recordedByUserId correctly
    - [ ] idempotent replay: same (recordedByUserId,idempotencyKey) returns existing event
    - [ ] different idempotencyKey but same dose => DUPLICATE
    - [ ] today merges doses->event (0/1), sorted scheduledAt ASC
    - [ ] history order scheduledAt DESC + id DESC and nextCursor generated

### 2.6 Routes / Controllers
- [ ] T017 Implement POST /adherence/taken  
  - Files:
    - `web-api/src/routes/adherence.ts`
    - `web-api/src/controllers/adherence_controller.ts`
  - Done:
    - [ ] validates inputs (medicationId, scheduledAt, targetPatientId)
    - [ ] requires Idempotency-Key
    - [ ] maps errors to required error_code set
    - [ ] response matches openapi

- [ ] T018 Implement GET /adherence/today  
  - Files:
    - `web-api/src/routes/adherence.ts`
    - `web-api/src/controllers/adherence_controller.ts`
  - Done:
    - [ ] date default = patient TZ “today”
    - [ ] returns doses[] primary + optional event (0/1)
    - [ ] returns monthMarks for month containing date
    - [ ] response matches openapi

- [ ] T019 Implement GET /adherence/history  
  - Files:
    - `web-api/src/routes/adherence.ts`
    - `web-api/src/controllers/adherence_controller.ts`
  - Done:
    - [ ] from/to inclusive in patient TZ (range logic per spec)
    - [ ] limit default 50; limit>200 => LIMIT_EXCEEDED
    - [ ] cursor binding enforced; invalid => INVALID_CURSOR
    - [ ] response matches openapi

### 2.7 Observability / structured logs
- [ ] T020 Add structured logging hooks  
  - Files:
    - `web-api/src/lib/logger.ts`
    - `web-api/src/services/adherence_service.ts`
  - Done:
    - [ ] logs: created/duplicate/idempotent_replay/today_fetched/history_fetched/authz_denied
    - [ ] include requestId/traceId + internal ids only
    - [ ] no email/token/link code/patientSessionToken logged

### 2.8 iOS clients + minimal UI
> iOSはテスト自動化より「ビルド＋Quickstartで主要フロー確認」がMVPの最低ライン

- [ ] T021 Implement iOS networking clients for adherence APIs  
  - Files:
    - `ios-patient/Sources/Adherence/AdherenceAPI.swift`
    - `ios-family/Sources/Adherence/AdherenceAPI.swift`
  - Done:
    - [ ] request/response types align with openapi
    - [ ] error_code mapping to user messages

- [ ] T022 [US1] Implement ios-patient TAKEN flow  
  - Files:
    - `ios-patient/Sources/Adherence/AdherenceViewModel.swift`
    - `ios-patient/Sources/Adherence/AdherenceView.swift`
  - Done:
    - [ ] uses patientSessionToken
    - [ ] can create TAKEN and refresh today view
    - [ ] shows DUPLICATE / EXPIRED errors

- [ ] T023 [US2] Implement ios-family patient select + proxy TAKEN flow  
  - Files:
    - `ios-family/Sources/Adherence/AdherenceViewModel.swift`
    - `ios-family/Sources/Adherence/AdherenceView.swift`
  - Done:
    - [ ] select patient context
    - [ ] create TAKEN with targetPatientId
    - [ ] unlink denial displayed

- [ ] T024 [US3] Implement minimal Today UI (day view + month marks)  
  - Files:
    - `ios-patient/Sources/Adherence/AdherenceView.swift`
    - `ios-family/Sources/Adherence/AdherenceView.swift`
  - Done:
    - [ ] shows doses in scheduledAt order with status (no fancy UI)
    - [ ] month marks are visible (simple dots/flags)

- [ ] T025 [US4] Implement minimal History UI (from/to + cursor pagination)  
  - Files:
    - `ios-patient/Sources/Adherence/AdherenceHistoryView.swift`
    - `ios-family/Sources/Adherence/AdherenceHistoryView.swift`
  - Done:
    - [ ] can fetch range
    - [ ] can paginate via nextCursor
    - [ ] handles INVALID_CURSOR / LIMIT_EXCEEDED display

### 2.9 Quickstart doc (prepare)
- [ ] T026 Write/Update quickstart instructions (draft)  
  - Files:
    - `specs/001-adherence-history/quickstart.md`
  - Done:
    - [ ] seed/setup (family user, patient, link, medication, doses, events)
    - [ ] login (family login, patient session via link code/token)
    - [ ] steps match implemented flows
    - [ ] expected results include key error cases (DUPLICATE/INVALID_CURSOR/AUTHZ_DENIED)

---

## Phase 3: Verification (REQUIRED LAST)

- [ ] T027 Run quickstart end-to-end and capture evidence  
  - Files:
    - `specs/001-adherence-history/quickstart.md`
  - Done:
    - [ ] screenshots/logs for: TAKEN created, duplicate rejected, idempotent replay, today/history reflect
    - [ ] unlink → access denied evidence
    - [ ] invalid cursor evidence

- [ ] T028 Run CI/builds  
  - Done:
    - [ ] web-api: lint/typecheck/tests all green
    - [ ] ios-patient build green
    - [ ] ios-family build green

- [ ] T029 Resolve /speckit.analyze findings  
  - Done:
    - [ ] major issues = 0
    - [ ] any spec/plan drift folded back into spec/plan/tasks

---

## Dependencies / Notes
- US order: US1 → US2 → US3 → US4
- 001 does NOT implement medication CRUD / dose generation logic (002+). For 001, doses are stored/seeded.
- patientSessionToken issuance is a dependency: must be documented + verifiable in quickstart (and smoke-tested if endpoint exists).
