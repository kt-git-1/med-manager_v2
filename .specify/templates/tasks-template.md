# Tasks: <Feature ID> <Feature Name>

## Rules
- Tasks must be ordered: **Tests → Implementation → Verification**
- Each task must include: **file paths** + **done condition**
- No implementation tasks without corresponding tests (except Emergency Fix Protocol)

---

## 1) Tests (REQUIRED FIRST)

### T001: <contract test title>
- Type: Contract Test
- Files:
  - <path>
- Done:
  - [ ] asserts request/response schema
  - [ ] asserts error format + codes/messages
  - [ ] asserts authz boundary
  - [ ] asserts pagination (if applicable)

### T002: <integration test title>
- Type: Integration Test
- Files:
  - <path>
- Done:
  - [ ] end-to-end within service (DB 포함)
  - [ ] covers main flow + relevant exception paths

---

## 2) Implementation

### T010: <web-api implementation title>
- Files:
  - <path>
- Done:
  - [ ] matches contracts
  - [ ] input validation implemented
  - [ ] logging added for key actions/errors
  - [ ] no PII leaked in logs

### T011: <ios-patient implementation title>
- Files:
  - <path>
- Done:
  - [ ] build passes
  - [ ] main UI flow implemented

### T012: <ios-family implementation title>
- Files:
  - <path>
- Done:
  - [ ] build passes
  - [ ] main UI flow implemented

---

## 3) Verification (REQUIRED LAST)

### V001: Quickstart run
- Files:
  - specs/<feature-id>-<slug>/quickstart.md
- Done:
  - [ ] run steps and confirm expected results
  - [ ] evidence captured (log/screenshot/recording) if required

### V002: CI green
- Done:
  - [ ] web-api CI: lint/typecheck/tests green
  - [ ] ios-patient build green
  - [ ] ios-family build green

---

## /speckit.analyze
- Done:
  - [ ] analyze findings resolved (major = 0)
