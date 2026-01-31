# Data Model: 001 Adherence History (MVP)

## Entities

### patient
- id
- displayName
- timezone

### family_link
- id
- familyUserId
- patientId
- status: active | unlinked
- linkedAt
- unlinkedAt

### medication
- id
- patientId
- name
- inventoryCount
- lowStockThreshold

### schedule_dose (computed or stored)
- id (if stored)
- patientId
- medicationId
- slot: morning | noon | night | bed
- scheduledAt (patient TZ resolved to datetime)

### adherence_event
- id
- patientId
- medicationId
- scheduledAt
- status: TAKEN | MISSED | RESOLVED
- recordedBy: patient | family
- recordedByUserId
- createdAt
- resolvedAt (nullable)
- idempotencyKey (nullable)

### calendar_mark (derived)
- patientId
- date (patient TZ date)
- hasEvents (boolean)

## Relationships
- patient 1..n medication
- patient 1..n schedule_dose
- patient 1..n adherence_event
- family_user 1..n family_link
- family_link -> patient

## Validation & Constraints
- adherence_event TAKEN unique: (patientId, medicationId, scheduledAt)
- adherence_event status in enum
- from/to interpreted in patient TZ, inclusive
- family_link status must be active for access

## State Transitions
- MISSED -> RESOLVED when TAKEN recorded after 60min
- TAKEN cannot be edited or canceled
