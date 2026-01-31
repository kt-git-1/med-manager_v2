import type { FastifyPluginAsync } from "fastify";

import {
  requireAuth,
  assertRolePresent,
  validatePatientAuthZ,
  validateFamilyAuthZ,
  ApplicationError,
  type PatientAuthContext,
  type FamilyAuthContext,
} from "../middleware/authz.js";

import { adherenceQueries } from "../db/queries/adherence_queries.js";

type TakenRequest = {
  medicationId: string;
  scheduledAt: string; // ISO
  targetPatientId?: string; // family only
};

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function parseIdempotencyKey(req: any): string {
  const raw = req.headers?.["idempotency-key"];
  const key = Array.isArray(raw) ? raw[0] : raw;
  if (!asString(key)) {
    throw new ApplicationError(400, "INVALID_ARGUMENT", "Invalid argument", {
      field: "Idempotency-Key",
      reason: "missing",
    });
  }
  return key;
}

function parseDateOnly(v: unknown, field: string): string {
  const s = asString(v);
  if (!s) throw new ApplicationError(400, "INVALID_ARGUMENT", "Invalid argument", { field, reason: "missing" });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new ApplicationError(400, "INVALID_ARGUMENT", "Invalid argument", { field, reason: "format" });
  }
  return s;
}

function parseOptionalDateOnly(v: unknown): string | null {
  const s = asString(v);
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

function parseLimit(v: unknown): number {
  if (v == null) return 50;
  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    throw new ApplicationError(400, "INVALID_ARGUMENT", "Invalid argument", { field: "limit" });
  }
  if (n > 200) {
    throw new ApplicationError(400, "LIMIT_EXCEEDED", "Limit exceeded", { max: 200 });
  }
  return n;
}

function parseIso(v: unknown, field: string): string {
  const s = asString(v);
  if (!s) throw new ApplicationError(400, "INVALID_ARGUMENT", "Invalid argument", { field, reason: "missing" });
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    throw new ApplicationError(400, "INVALID_ARGUMENT", "Invalid argument", { field, reason: "invalid_datetime" });
  }
  return d.toISOString();
}

function parseTakenBody(body: any): TakenRequest {
  if (!body || typeof body !== "object") {
    throw new ApplicationError(400, "INVALID_ARGUMENT", "Invalid argument");
  }
  const medicationId = asString(body.medicationId);
  if (!medicationId) throw new ApplicationError(400, "INVALID_ARGUMENT", "Invalid argument", { field: "medicationId" });

  const scheduledAt = parseIso(body.scheduledAt, "scheduledAt");

  const targetPatientId = body.targetPatientId != null ? asString(body.targetPatientId) : undefined;
  if (body.targetPatientId != null && !targetPatientId) {
    throw new ApplicationError(400, "INVALID_ARGUMENT", "Invalid argument", { field: "targetPatientId" });
  }

  return { medicationId, scheduledAt, targetPatientId };
}

function resolvePatientId(ctx: PatientAuthContext | FamilyAuthContext, targetPatientId?: string): string {
  if (ctx.role === "patient") {
    if (targetPatientId) {
      throw new ApplicationError(400, "INVALID_ARGUMENT", "Invalid argument", {
        field: "targetPatientId",
        reason: "patient_cannot_set",
      });
    }
    validatePatientAuthZ(ctx);
    return ctx.patientId;
  }

  if (!targetPatientId) {
    throw new ApplicationError(400, "INVALID_ARGUMENT", "Invalid argument", {
      field: "targetPatientId",
      reason: "missing_for_family",
    });
  }
  validateFamilyAuthZ(ctx, targetPatientId);
  return targetPatientId;
}

const adherenceRoutes: FastifyPluginAsync = async (app) => {
  // POST /adherence/taken
  app.post("/adherence/taken", { preHandler: [requireAuth] }, async (req, reply) => {
    assertRolePresent(req);
    const ctx = req.auth;

    const idem = parseIdempotencyKey(req);
    const body = parseTakenBody(req.body);

    const patientId = resolvePatientId(ctx, body.targetPatientId);

    const actor =
      ctx.role === "patient"
        ? { type: "PATIENT" as const, userId: ctx.userId }
        : { type: "FAMILY" as const, userId: ctx.familyUserId };

    const created = adherenceQueries.createTaken({
      patientId,
      medicationId: body.medicationId,
      scheduledAt: body.scheduledAt,
      actor,
      idempotencyKey: idem,
    });

    const recordedBy = ctx.role === "patient" ? "patient" : "family";
    const recordedByUserId = ctx.role === "patient" ? ctx.userId : ctx.familyUserId;

    reply.code(200).send({
      adherenceEventId: created.adherenceEventId,
      patientId,
      medicationId: body.medicationId,
      status: "TAKEN",
      recordedBy,
      recordedByUserId,
    });
  });

  // GET /adherence/today
  app.get("/adherence/today", { preHandler: [requireAuth] }, async (req, reply) => {
    assertRolePresent(req);
    const ctx = req.auth;

    const q = (req.query ?? {}) as Record<string, unknown>;
    const date = parseOptionalDateOnly(q.date) ?? new Date().toISOString().slice(0, 10);

    const targetPatientId = q.targetPatientId != null ? asString(q.targetPatientId) ?? undefined : undefined;
    const patientId = resolvePatientId(ctx, targetPatientId);

    reply.code(200).send(adherenceQueries.getTodayDoses(patientId, date));
  });

  // GET /adherence/history
  app.get("/adherence/history", { preHandler: [requireAuth] }, async (req, reply) => {
    assertRolePresent(req);
    const ctx = req.auth;

    const q = (req.query ?? {}) as Record<string, unknown>;
    const from = parseDateOnly(q.from, "from");
    const to = parseDateOnly(q.to, "to");
    const limit = parseLimit(q.limit);
    const cursor = asString(q.cursor) ?? null;

    const targetPatientId = q.targetPatientId != null ? asString(q.targetPatientId) ?? undefined : undefined;
    const patientId = resolvePatientId(ctx, targetPatientId);

    reply.code(200).send(adherenceQueries.getHistory({ patientId, from, to, limit, cursor }));
  });
};

export default adherenceRoutes;
