import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assertErrorShape } from "../helpers/assertions.js";
import { buildTestApp } from "../helpers/testApp.js";

type EventItem = { scheduledAt: string };

function isSortedDesc(events: EventItem[]) {
  for (let i = 1; i < events.length; i += 1) {
    if (events[i - 1].scheduledAt < events[i].scheduledAt) return false;
  }
  return true;
}

describe("Integration: GET /adherence/history", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns history sorted by scheduledAt DESC", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/adherence/history?from=2026-01-01&to=2026-01-31&limit=50",
      headers: { "X-Patient-Session": "ps_patient_001" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({
      events: expect.any(Array),
      nextCursor: expect.anything(),
    });

    const events = body.events as EventItem[];
    if (events.length > 1) {
      expect(isSortedDesc(events)).toBe(true);
    }
  });

  it("invalid cursor returns INVALID_CURSOR", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/adherence/history?from=2026-01-01&to=2026-01-31&cursor=badcursor",
      headers: { "X-Patient-Session": "ps_patient_001" },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    assertErrorShape(body);
    expect(body.error_code).toBe("INVALID_CURSOR");
  });

  it("cursor mismatch for different range returns INVALID_CURSOR", async () => {
    const first = await app.inject({
      method: "GET",
      url: "/adherence/history?from=2026-01-01&to=2026-01-31",
      headers: { "X-Patient-Session": "ps_patient_001" },
    });

    expect(first.statusCode).toBe(200);
    const firstBody = first.json();
    const cursor = firstBody.nextCursor as string | null;

    const res = await app.inject({
      method: "GET",
      url: `/adherence/history?from=2026-02-01&to=2026-02-28&cursor=${encodeURIComponent(
        cursor ?? "missing"
      )}`,
      headers: { "X-Patient-Session": "ps_patient_001" },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    assertErrorShape(body);
    expect(body.error_code).toBe("INVALID_CURSOR");
  });

  it("denies access when family link is inactive", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/adherence/history?targetPatientId=patient_001&from=2026-01-01&to=2026-01-31",
      headers: { Authorization: "Bearer family_unlinked" },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    assertErrorShape(body);
    expect(body.error_code).toBe("AUTHORIZATION_DENIED");
  });
});
