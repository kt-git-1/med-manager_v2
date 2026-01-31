import Fastify, { type FastifyInstance } from "fastify";

import adherenceRoutes from "./routes/adherence.js";

type ErrorResponse = {
  error_code: string;
  message: string;
  details?: unknown;
};

function toErrorResponse(err: unknown): { statusCode: number; body: ErrorResponse } {
  const e = err as any;

  const statusCode =
    typeof e?.statusCode === "number"
      ? e.statusCode
      : typeof e?.status === "number"
        ? e.status
        : 500;

  const error_code =
    typeof e?.error_code === "string"
      ? e.error_code
      : typeof e?.code === "string"
        ? e.code
        : statusCode === 404
          ? "NOT_FOUND"
          : statusCode === 401
            ? "UNAUTHORIZED"
            : "INTERNAL";

  const message =
    typeof e?.message === "string" && e.message.length > 0
      ? e.message
      : statusCode === 404
        ? "Not found"
        : statusCode === 401
          ? "Unauthorized"
          : "Internal server error";

  const details = e?.details;

  return {
    statusCode: statusCode >= 400 && statusCode <= 599 ? statusCode : 500,
    body: details === undefined ? { error_code, message } : { error_code, message, details },
  };
}

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: true });

  // --- Health ---
  app.get("/health", async () => ({ ok: true }));
  // クライアント/Docsが /api を前提にしてても困らないように両方生やす
  app.get("/api/health", async () => ({ ok: true }));

  // --- Routes ---
  // contract tests: /adherence/*
  app.register(adherenceRoutes);
  // OpenAPI servers: /api を想定するクライアント向け
  app.register(adherenceRoutes, { prefix: "/api" });

  // --- Not Found (契約テスト用の形に寄せる) ---
  app.setNotFoundHandler((req, reply) => {
    reply.code(404).send({ error_code: "NOT_FOUND", message: `Route ${req.method}:${req.url} not found` });
  });

  // --- Error mapping (error_code を必ず返す) ---
  app.setErrorHandler((err, req, reply) => {
    const { statusCode, body } = toErrorResponse(err);
    req.log.error({ err }, "request failed");
    reply.code(statusCode).send(body);
  });

  return app;
}
