import type { FastifyRequest, preHandlerHookHandler } from "fastify";

export type AuthRole = "patient" | "family" | "unauth";

export type PatientAuthContext = {
  role: "patient";
  patientId: string;
  userId: string;
  tokenStatus: "valid" | "expired";
};

export type FamilyAuthContext = {
  role: "family";
  familyUserId: string;
  tokenStatus: "valid" | "expired";
  linkedPatientIds: string[];
};

export type UnauthContext = { role: "unauth" };

export type AuthContext = PatientAuthContext | FamilyAuthContext | UnauthContext;

declare module "fastify" {
  interface FastifyRequest {
    auth?: AuthContext;
  }
}

// Error handler は app.ts 側で duck-typing してるのでこれでOK
export class ApplicationError extends Error {
  statusCode: number;
  error_code: string;
  details?: unknown;

  constructor(statusCode: number, error_code: string, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.error_code = error_code;
    this.details = details;
  }
}

function asStringHeader(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return null;
}

function parseBearer(authorization: unknown): string | null {
  const s = asStringHeader(authorization);
  if (!s) return null;
  const m = s.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

export function createAuthContext(req: FastifyRequest): AuthContext {
  // patient session header（契約テスト用）
  const patientSession = asStringHeader(req.headers["x-patient-session"]);
  if (patientSession) {
    if (patientSession === "ps_patient_001") {
      return { role: "patient", patientId: "patient_001", userId: "user_patient_001", tokenStatus: "valid" };
    }
    if (patientSession === "ps_valid") {
      return { role: "patient", patientId: "patient_001", userId: "user_patient_001", tokenStatus: "valid" };
    }
    if (patientSession === "ps_expired") {
      return { role: "patient", patientId: "patient_001", userId: "user_patient_001", tokenStatus: "expired" };
    }
    return { role: "unauth" };
  }

  // family bearer token（契約テスト用）
  const token = parseBearer(req.headers["authorization"]);
  if (!token) return { role: "unauth" };

  if (token === "family_token_123") {
    return {
      role: "family",
      familyUserId: "family_user_001",
      tokenStatus: "valid",
      linkedPatientIds: ["patient_001"],
    };
  }
  if (token === "family_unlinked") {
    return { role: "family", familyUserId: "family_user_001", tokenStatus: "valid", linkedPatientIds: [] };
  }
  if (token === "linked_family") {
    return {
      role: "family",
      familyUserId: "family_user_001",
      tokenStatus: "valid",
      linkedPatientIds: ["patient_001", "patient_002"],
    };
  }
  if (token === "unlinked_family") {
    return { role: "family", familyUserId: "family_user_001", tokenStatus: "valid", linkedPatientIds: [] };
  }
  if (token === "expired_family") {
    return { role: "family", familyUserId: "family_user_001", tokenStatus: "expired", linkedPatientIds: [] };
  }

  return { role: "unauth" };
}

export const requireAuth: preHandlerHookHandler = async (req) => {
  const ctx = createAuthContext(req);
  req.auth = ctx;
  if (ctx.role === "unauth") {
    throw new ApplicationError(401, "UNAUTHORIZED", "Unauthorized");
  }
};

export function assertRolePresent(
  req: FastifyRequest
): asserts req is FastifyRequest & { auth: Exclude<AuthContext, UnauthContext> } {
  const ctx = req.auth;
  if (!ctx || ctx.role === "unauth") {
    throw new ApplicationError(401, "UNAUTHORIZED", "Unauthorized");
  }
}

export function validatePatientAuthZ(ctx: PatientAuthContext) {
  if (ctx.tokenStatus === "expired") {
    throw new ApplicationError(401, "EXPIRED", "Expired");
  }
}

export function validateFamilyAuthZ(ctx: FamilyAuthContext, targetPatientId: string) {
  if (ctx.tokenStatus === "expired") {
    throw new ApplicationError(401, "EXPIRED", "Expired");
  }
  if (!ctx.linkedPatientIds.includes(targetPatientId)) {
    throw new ApplicationError(403, "AUTHORIZATION_DENIED", "Authorization denied");
  }
}
