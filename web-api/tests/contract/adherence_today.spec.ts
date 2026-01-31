import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assertErrorCode } from "../helpers/assertions.js";
import { API_BASE, buildTestApp } from "../helpers/testApp.js";

type Dose = { scheduledAt: string; event: unknown };

function isSortedAscByTime(doses: Dose[]) {
  for (let i = 1; i < doses.length; i += 1) {
    const prev = new Date(doses[i - 1].scheduledAt).getTime();
    const cur = new Date(doses[i].scheduledAt).getTime();
    if (prev > cur) return false;
  }
  return true;
}

describe("Integration: GET /adherence/today", () => {
  let app: FastifyInstance;
  const url = `${API_BASE}/adherence/today`;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("200 merges doses with optional event and sorts by scheduledAt ASC", async () => {
    const res = await app.inject({
      method: "GET",
      url: `${url}?date=2026-01-30`,
      headers: { "X-Patient-Session": "ps_patient_001" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body).toMatchObject({
      doses: expect.any(Array),
      monthMarks: expect.any(Array),
    });

    const doses = body.doses as Dose[];
    expect(isSortedAscByTime(doses)).toBe(true);

    for (const dose of doses) {
      expect(dose).toHaveProperty("scheduledAt");
      expect("event" in dose).toBe(true);
      expect(dose.event === null || typeof dose.event === "object").toBe(true);
    }
  });

  it("403 AUTHORIZATION_DENIED when family link is inactive", async () => {
    const res = await app.inject({
      method: "GET",
      url: `${url}?targetPatientId=patient_001&date=2026-01-30`,
      headers: { Authorization: "Bearer family_unlinked" },
    });

    expect(res.statusCode).toBe(403);
    assertErrorCode(res.json(), "AUTHORIZATION_DENIED");
  });
});
