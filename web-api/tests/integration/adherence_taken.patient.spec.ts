import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assertErrorShape } from "../helpers/assertions.js";
import { buildTestApp } from "../helpers/testApp.js";

describe("Integration: POST /adherence/taken (patient)", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("creates TAKEN and supports idempotent replay", async () => {
    const payload = {
      medicationId: "med_001",
      scheduledAt: "2026-01-30T09:00:00+09:00",
    };

    const headers = {
      "X-Patient-Session": "ps_patient_001",
      "Idempotency-Key": "idem_patient_001",
    };

    const first = await app.inject({
      method: "POST",
      url: "/adherence/taken",
      headers,
      payload,
    });

    expect(first.statusCode).toBe(200);
    const firstBody = first.json();
    expect(firstBody).toMatchObject({
      adherenceEventId: expect.any(String),
      status: "TAKEN",
      recordedBy: "patient",
      recordedByUserId: expect.any(String),
    });

    const replay = await app.inject({
      method: "POST",
      url: "/adherence/taken",
      headers,
      payload,
    });

    expect(replay.statusCode).toBe(200);
    const replayBody = replay.json();
    expect(replayBody).toMatchObject({
      adherenceEventId: firstBody.adherenceEventId,
      status: "TAKEN",
      recordedBy: "patient",
    });
  });

  it("rejects duplicate same dose with different idempotency key", async () => {
    const payload = {
      medicationId: "med_001",
      scheduledAt: "2026-01-30T09:00:00+09:00",
    };

    const res = await app.inject({
      method: "POST",
      url: "/adherence/taken",
      headers: {
        "X-Patient-Session": "ps_patient_001",
        "Idempotency-Key": "idem_patient_dup",
      },
      payload,
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    assertErrorShape(body);
    expect(body.error_code).toBe("DUPLICATE");
  });
});
