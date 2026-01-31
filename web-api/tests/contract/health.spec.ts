import { describe, it, expect } from "vitest";
import { buildApp } from "../../src/app.js";

describe("GET /health", () => {
  it("returns ok", async () => {
    const app = buildApp();
    await app.ready();

    try {
      const res = await app.inject({
        method: "GET",
        url: "/health",
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ ok: true });
    } finally {
      await app.close();
    }
  });
});
