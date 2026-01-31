import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assertErrorShape } from "../helpers/assertions.js";
import { buildTestApp } from "../helpers/testApp.js";

describe("Integration: POST /adherence/taken (family)", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("creates TAKEN for linked patient", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/adherence/taken",
      headers: {
        Authorization: "Bearer family_token_123",
        "Idempotency-Key": "idem_family_001",
      },
      payload: {
        targetPatientId: "patient_001",
        medicationId: "med_001",
        scheduledAt: "2026-01-30T09:00:00+09:00",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({
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
      url: "/adherence/taken",
      headers: {
        Authorization: "Bearer family_unlinked",
        "Idempotency-Key": "idem_family_unlinked",
      },
      payload: {
        targetPatientId: "patient_001",
        medicationId: "med_001",
        scheduledAt: "2026-01-30T09:00:00+09:00",
      },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    assertErrorShape(body);
    expect(body.error_code).toBe("AUTHORIZATION_DENIED");
  });

  it("rejects duplicate same dose with different idempotency key", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/adherence/taken",
      headers: {
        Authorization: "Bearer family_token_123",
        "Idempotency-Key": "idem_family_dup",
      },
      payload: {
        targetPatientId: "patient_001",
        medicationId: "med_001",
        scheduledAt: "2026-01-30T09:00:00+09:00",
      },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    assertErrorShape(body);
    expect(body.error_code).toBe("DUPLICATE");
  });
});
