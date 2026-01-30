import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assertErrorCode } from "../helpers/assertions.js";
import { API_BASE, buildTestApp } from "../helpers/testApp.js";

/**
 * Preconditions (seed/auth stub assumptions):
 * - Authorization: "Bearer family_token_123" is linked to patient_001 (active)
 * - Authorization: "Bearer family_unlinked" is NOT linked (or unlinked) to patient_001
 * - medication "med_001" exists for patient_001
 */

describe("Integration: POST /adherence/taken (family)", () => {
  let app: FastifyInstance;
  const url = `${API_BASE}/adherence/taken`;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("creates TAKEN for linked patient", async () => {
    const res = await app.inject({
      method: "POST",
      url,
      headers: {
        Authorization: "Bearer family_token_123",
        "Idempotency-Key": "idem_family_001",
        "content-type": "application/json",
      },
      payload: {
        targetPatientId: "patient_001",
        medicationId: "med_001",
        scheduledAt: "2026-01-30T09:00:00+09:00",
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      adherenceEventId: expect.any(String),
      patientId: "patient_001",
      status: "TAKEN",
      recordedBy: "family",
      recordedByUserId: expect.any(String),
    });
  });

  it("denies access after unlink", async () => {
    const res = await app.inject({
      method: "POST",
      url,
      headers: {
        Authorization: "Bearer family_unlinked",
        "Idempotency-Key": "idem_family_unlinked",
        "content-type": "application/json",
      },
      payload: {
        targetPatientId: "patient_001",
        medicationId: "med_001",
        scheduledAt: "2026-01-30T11:00:00+09:00",
      },
    });

    expect(res.statusCode).toBe(403);
    assertErrorCode(res.json(), "AUTHORIZATION_DENIED");
  });

  it("409 DUPLICATE when same dose is taken with different idempotency keys", async () => {
    const payload = {
      targetPatientId: "patient_001",
      medicationId: "med_001",
      scheduledAt: "2026-01-30T12:00:00+09:00",
    };

    const a = await app.inject({
      method: "POST",
      url,
      headers: {
        Authorization: "Bearer family_token_123",
        "Idempotency-Key": "idem_family_dup_a",
        "content-type": "application/json",
      },
      payload,
    });
    expect(a.statusCode).toBe(200);

    const b = await app.inject({
      method: "POST",
      url,
      headers: {
        Authorization: "Bearer family_token_123",
        "Idempotency-Key": "idem_family_dup_b",
        "content-type": "application/json",
      },
      payload,
    });

    expect(b.statusCode).toBe(409);
    assertErrorCode(b.json(), "DUPLICATE");
  });
});
