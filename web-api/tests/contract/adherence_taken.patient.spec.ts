import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assertErrorCode } from "../helpers/assertions.js";
import { API_BASE, buildTestApp } from "../helpers/testApp.js";

/**
 * Preconditions (seed/auth stub assumptions):
 * - X-Patient-Session: "ps_patient_001" is a valid patient session for patient_001
 * - medication "med_001" exists & belongs to patient_001
 */

describe("Integration: POST /adherence/taken (patient)", () => {
  let app: FastifyInstance;
  const url = `${API_BASE}/adherence/taken`;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("400 INVALID_ARGUMENT when Idempotency-Key is missing", async () => {
    const res = await app.inject({
      method: "POST",
      url,
      headers: {
        "X-Patient-Session": "ps_patient_001",
        "content-type": "application/json",
      },
      payload: {
        medicationId: "med_001",
        scheduledAt: "2026-01-30T08:00:00+09:00",
      },
    });

    expect(res.statusCode).toBe(400);
    assertErrorCode(res.json(), "INVALID_ARGUMENT");
  });

  it("creates TAKEN and supports idempotent replay", async () => {
    const payload = {
      medicationId: "med_001",
      scheduledAt: "2026-01-30T09:00:00+09:00",
    };

    const headers = {
      "X-Patient-Session": "ps_patient_001",
      "Idempotency-Key": "idem_patient_001",
      "content-type": "application/json",
    };

    const first = await app.inject({ method: "POST", url, headers, payload });
    expect(first.statusCode).toBe(200);

    const firstBody = first.json();
    expect(firstBody).toMatchObject({
      adherenceEventId: expect.any(String),
      status: "TAKEN",
      recordedBy: "patient",
      recordedByUserId: expect.any(String),
      medicationId: payload.medicationId,
    });

    const replay = await app.inject({ method: "POST", url, headers, payload });
    expect(replay.statusCode).toBe(200);

    const replayBody = replay.json();
    expect(replayBody.adherenceEventId).toBe(firstBody.adherenceEventId);
    expect(replayBody.status).toBe("TAKEN");
    expect(replayBody.recordedBy).toBe("patient");
  });

  it("409 DUPLICATE when same dose is taken with different idempotency keys", async () => {
    const payload = {
      medicationId: "med_001",
      scheduledAt: "2026-01-30T10:00:00+09:00",
    };

    const a = await app.inject({
      method: "POST",
      url,
      headers: {
        "X-Patient-Session": "ps_patient_001",
        "Idempotency-Key": "idem_patient_dup_a",
        "content-type": "application/json",
      },
      payload,
    });
    expect(a.statusCode).toBe(200);

    const b = await app.inject({
      method: "POST",
      url,
      headers: {
        "X-Patient-Session": "ps_patient_001",
        "Idempotency-Key": "idem_patient_dup_b",
        "content-type": "application/json",
      },
      payload,
    });

    expect(b.statusCode).toBe(409);
    assertErrorCode(b.json(), "DUPLICATE");
  });
});
