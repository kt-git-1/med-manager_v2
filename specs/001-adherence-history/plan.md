# Plan: 001 Adherence History (MVP)

## Technical Context
- Modules impacted: web-api / ios-patient / ios-family
- Data sources:
  - adherence events (TAKEN/MISSED/RESOLVED)
  - schedule/dose (MVPは **stored** を前提。seedで投入し、002以降で生成ロジックを導入して同テーブルへ流し込む)
  - medication
  - patient/family link
- AuthN:
  - family: Supabase Auth（email/password）→ family token
  - patient: link code → patientSessionToken（spec）
- AuthZ:
  - patient self-only
  - family only linked patients
  - unlink revokes past access
- Contracts location: `specs/001-adherence-history/contracts/` (feature-scoped, per constitution)
- Constraints:
  - no offline queue
  - calendar UI is day view + month marks only

## Constitution Check (pre-design)
- [x] Spec is source of truth
- [x] Clarification gate: no [NEEDS CLARIFICATION]
- [x] Exception paths reflected in AC/test plan
- [x] Quickstart required
- [x] Data retention & auditability addressed in plan

## Decisions (Why / Why not)
- Key decisions:
  - Same dose key = `(patientId, medicationId, scheduledAt in patient TZ)`; enforce uniqueness at DB level.
  - `GET /adherence/today` は **予定（dose）を主語**にして返す（UIのマージを統一）。
  - Contracts stored under feature folder to avoid cross-feature drift.
  - Cursor pagination is opaque, bound to **patientId + time-range + sort order**.
  - Idempotency is enforced by a separate uniqueness key: `(recordedByUserId, idempotencyKey)`.
- Alternatives considered:
  - Same dose key using scheduleId + date instead of scheduledAt; rejected because schedule can change and scheduledAt is the fixed display/compute result.
  - Cursor as raw offset; rejected due to unstable ordering on inserts.
  - Persist idempotencyKey directly on adherence_event only; acceptable but still requires a separate uniqueness constraint. We keep it on event for MVP while enforcing `(recordedByUserId, idempotencyKey)` uniqueness.
- Non-goals:
  - Implement MISSED generation job
  - Weekly view / analytics

## Architecture / Structure
- Modules impacted: web-api / ios-patient / ios-family
- High-level flow:
  - ios-patient/family -> web-api create TAKEN (idempotent)
  - web-api -> returns adherence event
  - ios-patient/family -> web-api fetch today (doses + events)
  - ios-patient/family -> web-api fetch history (from/to + cursor)

## Data Model Changes
> 001では薬登録UI/生成ロジックは持たない。**予定(dose)はseedで投入されたものを使う**。002以降で薬登録→予定生成を実装し、同じ dose テーブルに流し込む。

- New/updated entities:
  - patient:
    - timezone
    - displayName
  - family_link:
    - familyUserId
    - patientId
    - status (`active` / `unlinked`)
    - unlinkedAt
  - medication (read-only here):
    - patientId
    - name
    - inventoryCount
    - lowStockThreshold
  - dose (stored in DB for MVP):
    - patientId
    - medicationId
    - slot (`morning/noon/night/bed`)
    - scheduledAt (patient TZに基づく実日時)
  - adherence_event:
    - patientId
    - medicationId
    - scheduledAt
    - status (`TAKEN/MISSED/RESOLVED`)
    - recordedBy (`patient/family`)
    - recordedByUserId (patientId or familyUserId)
    - idempotencyKey (MVPで保持)
    - createdAt
    - resolvedAt
  - calendar_mark (derived or stored):
    - patientId
    - date (patient TZのdate)
    - hasEvents
- Migrations (if any):
  - **Same dose uniqueness**
    - Add unique index on adherence_event `(patientId, medicationId, scheduledAt)` WHERE status = 'TAKEN'
  - **Idempotency uniqueness**
    - Add unique index on adherence_event `(recordedByUserId, idempotencyKey)` WHERE idempotencyKey IS NOT NULL
  - Query indexes
    - Add index on adherence_event `(patientId, scheduledAt)` for today/history queries
    - Add index on adherence_event `(patientId, scheduledAt DESC, id DESC)` for cursor paging (history sort)
    - Add index on dose `(patientId, scheduledAt)` for today queries
- Backfill / compatibility:
  - None for MVP; existing events assumed absent

## Same Dose Key + Idempotency
- Same dose key: `(patientId, medicationId, scheduledAt)`
- DB constraint strategy:
  - Unique index on adherence_event for TAKEN with same dose key
  - On conflict:
    - if `(recordedByUserId, idempotencyKey)` matches existing event -> return existing event (idempotent)
    - else -> return `DUPLICATE`
- Idempotency approach:
  - Require `Idempotency-Key` header on TAKEN create (MVP: required)
  - Persist idempotencyKey with adherence_event
  - Retry with same key returns same response
  - If same dose but different idempotencyKey -> DUPLICATE

## AuthZ Enforcement Points
- TAKEN create:
  - patientSessionToken -> patientId must match targetPatientId
  - family token -> must have active link to target patient
  - unlink status denies access (past included)
- Today/history fetch:
  - same as above; unlink denies both past and present
- Link validation:
  - family_link.status must be `active` at request time

## Contracts
- Contract artifacts location: `specs/001-adherence-history/contracts/`
- Endpoints:
  - POST `/adherence/taken`
  - GET `/adherence/today`
  - GET `/adherence/history`
- Error codes/messages:
  - `AUTHORIZATION_DENIED`, `NOT_FOUND`, `EXPIRED`, `DUPLICATE`, `INVALID_ARGUMENT`, `LIMIT_EXCEEDED`, `INVALID_CURSOR`
- AuthZ boundary:
  - patient self-only
  - family linked only
  - unlink revokes access (past included)
- Time rules:
  - patient TZ used for all day boundaries
  - from/to inclusive in patient TZ; from > to -> INVALID_ARGUMENT
- Pagination:
  - cursor/limit with stable ordering; invalid cursor -> INVALID_CURSOR
  - cursor is opaque and bound to patientId + range + sort order

### Contract Drafts (MVP shape)
#### POST /adherence/taken
- Request:
  - targetPatientId (family only; patient is implicit)
  - medicationId
  - scheduledAt (ISO datetime)
  - Header: `Idempotency-Key` (required)
- Response:
  - adherenceEventId
  - status=TAKEN
  - patientId, medicationId, scheduledAt
  - recordedBy, recordedByUserId
  - createdAt
- Notes:
  - same dose key uniqueness enforced
  - idempotency enforced by `(recordedByUserId, idempotencyKey)`

#### GET /adherence/today
- Request:
  - targetPatientId (family only; patient is implicit)
  - date (optional; omit => patient TZ “today”)
- Response (予定主語):
  - `doses[]`:
    - doseKey (composite: patientId+medicationId+scheduledAt, serialized)
    - patientId, medicationId, slot, scheduledAt
    - event (optional, 0 or 1):
      - status (TAKEN/MISSED/RESOLVED)
      - recordedBy, recordedByUserId
      - createdAt, resolvedAt (if applicable)
  - `monthMarks[]` (optional; or separate endpoint in future):
    - date
    - hasEvents
- Sorting:
  - doses sorted by scheduledAt ASC
- Notes:
  - UIは doses[].event で「予定×状態」を一意に表示できる

#### GET /adherence/history
- Request:
  - targetPatientId (family only; patient is implicit)
  - from (date, patient TZ)
  - to (date, patient TZ)
  - limit (default 50, max 200)
  - cursor (opaque)
- Response:
  - `events[]`:
    - adherenceEventId
    - status (TAKEN/MISSED/RESOLVED)
    - patientId, medicationId, scheduledAt
    - recordedBy, recordedByUserId
    - createdAt, resolvedAt
  - nextCursor (if more)
- Sorting (fixed):
  - scheduledAt DESC, adherenceEventId DESC
- Cursor binding:
  - encode patientId + from/to + lastSeen(scheduledAt, adherenceEventId)
  - validate decoded patientId + range match request

## Test Strategy (Traceability)
AC をどのテストで担保するか（最低限ここを埋める）
| AC | Contract Test | Integration Test | iOS Build | Manual Quickstart |
|---|---|---|---|---|
| US1-AC1 patient can create TAKEN | yes | yes | ios-patient | yes |
| US1-AC2 recordedBy patient | yes | yes | ios-patient | yes |
| US1-AC3 duplicate rejected | yes | yes | ios-patient | yes |
| US1-AC4 idempotent retry | yes | yes | ios-patient | yes |
| US1-AC5 no edits/cancel | yes | yes | ios-patient | yes |
| US2-AC1 family create TAKEN | yes | yes | ios-family | yes |
| US2-AC2 recordedBy family | yes | yes | ios-family | yes |
| US2-AC3 unlink denies | yes | yes | ios-family | yes |
| US3-AC1 today shows schedule+events | yes | yes | ios-patient/ios-family | yes |
| US3-AC2 today sort by scheduledAt | yes | yes | ios-patient/ios-family | yes |
| US3-AC3 month marks | yes | yes | ios-patient/ios-family | yes |
| US3-AC4 authz boundary | yes | yes | ios-patient/ios-family | yes |
| US3-AC5 unlink denies | yes | yes | ios-family | yes |
| US4-AC1 from/to inclusive | yes | yes | ios-patient/ios-family | yes |
| US4-AC2 cursor/limit | yes | yes | ios-patient/ios-family | yes |
| US4-AC3 authz | yes | yes | ios-patient/ios-family | yes |
| US4-AC4 limit exceeded | yes | yes | ios-patient/ios-family | yes |
| US4-AC5 invalid cursor | yes | yes | ios-patient/ios-family | yes |
| US4-AC6 invalid range | yes | yes | ios-patient/ios-family | yes |

## Risks & Mitigations
- Risk: schedule changes could invalidate same dose key consistency
- Mitigation: use scheduledAt at time of record (immutable), keep history consistent
- Risk: cursor misuse causes data leakage
- Mitigation: encode patientId + range in cursor and validate
- Risk: today endpoint merging logic diverges across clients
- Mitigation: return doses as primary structure with optional event (0/1) per dose

## Observability
- Logs to add (PIIなし):
  - adherence_taken_created (status, recordedBy, scheduledAt)
  - adherence_taken_duplicate
  - adherence_taken_idempotent_replay
  - adherence_history_fetched (from/to, limit, cursor_present)
  - adherence_today_fetched (date)
  - authz_denied (reason)
  - invalid_cursor / limit_exceeded / invalid_argument
- Metrics / trace IDs:
  - requestId/traceId required for all endpoints
  - include patientId, familyUserId (internal IDs only), adherenceEventId
  - do not log email/token/link code/patientSessionToken

## Quickstart Outline
quickstart.md に書く骨子：
- seed/setup:
  - family user, patient, link, medication, today doses (stored), events (TAKEN/MISSED/RESOLVED)
- login:
  - family login
  - patient session via link code
- steps:
  - family login -> select patient -> fetch today
  - patient session -> create TAKEN -> reflect in today
  - family create TAKEN -> reflect in today
  - fetch history with from/to + cursor
  - unlink -> family access denied
- expected results:
  - TAKEN created, duplicate rejected, idempotent retry, today/history reflect
  - authz denied after unlink, invalid cursor handled, limit exceeded handled
- evidence:
  - screenshots/logs of errors and event states (DUPLICATE/INVALID_CURSOR/AUTHZ_DENIED)

## Constitution Check (post-design)
- [x] Data model changes documented
- [x] Contracts drafted (today response shape fixed)
- [x] Test strategy mapped to ACs
- [x] Quickstart outline present
- [x] No unresolved clarifications
