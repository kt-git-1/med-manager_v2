# <Feature ID>: <Feature Name>

## Overview
- Goal:
- Users:
- In Scope:
- Out of Scope:

## User Stories
### US1: <title>
- Description:
- Acceptance Criteria (AC):
  - [ ] AC1:
  - [ ] AC2:
- Notes:

## Exception Paths (REQUIRED)
該当するものは必ず AC とテストに含める。
- [ ] Authorization denied (権限なし)
- [ ] Not found (存在しない)
- [ ] Expired (期限切れ)
- [ ] Duplicate (重複)
- [ ] Limit exceeded (上限超え)
- [ ] Offline / network loss (通信断)
- [ ] Retry / Idempotency (二重送信・リトライ耐性)
- [ ] Concurrency / Race (競合)

## Data & PII
- Entities involved:
- PII fields (if any):
- Redaction rule (logs/exports):
- Data retention / deletion (feature-specific):

## Non-Functional Minimums (feature-specific additions)
- Logging/Monitoring:
- Security (AuthZ boundary):
- Input validation:
- Error handling (error codes/messages):
- Performance targets (if any):

## Contracts (if applicable)
- API / event contract summary:
- Error format summary:
- Pagination (cursor/limit etc):
- AuthZ rules:

## Quickstart Requirements
この feature の quickstart.md に必ず含めること：
- seed/setup:
- login:
- steps:
- expected results:
- evidence (log/screenshot/screen recording if needed):

## Open Questions
> `[NEEDS CLARIFICATION]` を残す場合はここへ。/plan 前に 0 にする。
- [NEEDS CLARIFICATION] ...
