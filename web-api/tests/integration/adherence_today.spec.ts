import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assertErrorShape } from "../helpers/assertions.js";
import { buildTestApp } from "../helpers/testApp.js";

type Dose = {
  scheduledAt: string;
  event: unknown;
};

function isSortedAsc(doses: Dose[]) {
  for (let i = 1; i < doses.length; i += 1) {
    if (doses[i - 1].scheduledAt > doses[i].scheduledAt) return false;
  }
  return true;
}

describe("Integration: GET /adherence/today", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("merges doses with optional event and sorts by scheduledAt ASC", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/adherence/today",
      headers: { "X-Patient-Session": "ps_patient_001" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({
      doses: expect.any(Array),
      monthMarks: expect.any(Array),
    });

    const doses = body.doses as Dose[];
    if (doses.length > 1) {
      expect(isSortedAsc(doses)).toBe(true);
    }

    for (const dose of doses) {
      expect(dose).toHaveProperty("scheduledAt");
      expect("event" in dose).toBe(true);
      expect(
        dose.event === null || typeof dose.event === "object"
      ).toBe(true);
    }
  });

  it("denies access when family link is inactive", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/adherence/today?targetPatientId=patient_001",
      headers: { Authorization: "Bearer family_unlinked" },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    assertErrorShape(body);
    expect(body.error_code).toBe("AUTHORIZATION_DENIED");
  });
});
