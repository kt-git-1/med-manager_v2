import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/app.js";

export const API_BASE = "/api";

export async function buildTestApp(): Promise<FastifyInstance> {
  const app = buildApp();
  await app.ready();
  return app;
}
