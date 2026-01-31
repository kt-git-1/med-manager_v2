import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assertErrorCode } from "../helpers/assertions.js";
import { API_BASE, buildTestApp } from "../helpers/testApp.js";

type EventItem = { scheduledAt: string };

function isSortedDescByTime(events: EventItem[]) {
  for (let i = 1; i < events.length; i += 1) {
    const prev = new Date(events[i - 1].scheduledAt).getTime();
    const cur = new Date(events[i].scheduledAt).getTime();
    if (prev < cur) return false;
  }
  return true;
}

describe("Integration: GET /adherence/history", () => {
  let app: FastifyInstance;
  const url = `${API_BASE}/adherence/history`;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("200 returns history sorted by scheduledAt DESC", async () => {
    const res = await app.inject({
      method: "GET",
      url: `${url}?from=2026-01-01&to=2026-01-31&limit=50`,
      headers: { "X-Patient-Session": "ps_patient_001" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({
      events: expect.any(Array),
      nextCursor: expect.anything(),
    });

    const events = body.events as EventItem[];
    expect(isSortedDescByTime(events)).toBe(true);
  });

  it("400 INVALID_CURSOR when cursor is malformed", async () => {
    const res = await app.inject({
      method: "GET",
      url: `${url}?from=2026-01-01&to=2026-01-31&cursor=badcursor`,
      headers: { "X-Patient-Session": "ps_patient_001" },
    });

    expect(res.statusCode).toBe(400);
    assertErrorCode(res.json(), "INVALID_CURSOR");
  });

  it("400 INVALID_CURSOR when cursor range mismatches", async () => {
    const first = await app.inject({
      method: "GET",
      url: `${url}?from=2026-01-01&to=2026-01-31&limit=1`,
      headers: { "X-Patient-Session": "ps_patient_001" },
    });

    expect(first.statusCode).toBe(200);
    const cursor = first.json().nextCursor as string | null;

    // Seed前提を明示（ここが null ならテストデータ不足）
    expect(cursor).not.toBeNull();

    const res = await app.inject({
      method: "GET",
      url: `${url}?from=2026-02-01&to=2026-02-28&cursor=${encodeURIComponent(
        cursor as string
      )}`,
      headers: { "X-Patient-Session": "ps_patient_001" },
    });

    expect(res.statusCode).toBe(400);
    assertErrorCode(res.json(), "INVALID_CURSOR");
  });

  it("403 AUTHORIZATION_DENIED when family link is inactive", async () => {
    const res = await app.inject({
      method: "GET",
      url: `${url}?targetPatientId=patient_001&from=2026-01-01&to=2026-01-31`,
      headers: { Authorization: "Bearer family_unlinked" },
    });

    expect(res.statusCode).toBe(403);
    assertErrorCode(res.json(), "AUTHORIZATION_DENIED");
  });
});
