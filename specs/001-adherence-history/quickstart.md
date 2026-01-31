# Quickstart: 001 Adherence History (MVP)

## seed/setup
- Create family user, patient, and active family_link
- Create medication and today schedule (morning/noon/night/bed as needed)
- Create sample adherence events: TAKEN, MISSED, RESOLVED

## login
- Family login with email/password
- Patient session via link code to obtain patientSessionToken

## steps
1) Family login -> select patient -> fetch today (schedule + events)
2) Patient session -> create TAKEN -> verify reflected in today
3) Family -> create TAKEN (recordedBy=family) -> verify reflected in today
4) Fetch history with from/to + cursor paging
5) Unlink patient -> verify family access denied for today/history/TAKEN

## expected results
- TAKEN created, recordedBy values correct
- Duplicate TAKEN rejected, idempotent retry returns same result
- Today view shows schedule and events in order
- History returns correct range and nextCursor
- After unlink, family receives AUTHORIZATION_DENIED

## evidence
- Screenshots or logs showing TAKEN creation, duplicate handling, invalid cursor, and unlink denial
