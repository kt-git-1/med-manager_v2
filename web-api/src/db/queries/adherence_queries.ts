import { encodeHistoryCursor, decodeAndValidateHistoryCursor, InvalidCursorError } from "../../lib/cursor.js";
import { ApplicationError } from "../../middleware/authz.js";

type ActorType = "PATIENT" | "FAMILY";

export type AdherenceDose = {
  doseId: string;
  medicationId: string;
  scheduledAt: string; // ISO
  event?: { adherenceEventId: string; status: "TAKEN"; takenAt: string; actor: { type: ActorType; userId: string } };
};

export type TodayResponse = {
  date: string; // YYYY-MM-DD
  doses: AdherenceDose[];
  monthMarks: { date: string; hasEvents: boolean }[];
};

export type HistoryEvent = {
  adherenceEventId: string;
  patientId: string;
  medicationId: string;
  scheduledAt: string; // ISO
  takenAt: string; // ISO
  actor: { type: ActorType; userId: string };
};

export type HistoryResponse = {
  events: HistoryEvent[];
  nextCursor: string | null;
};

function isoDay(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function cmpDesc(a: HistoryEvent, b: HistoryEvent): number {
  if (a.scheduledAt > b.scheduledAt) return -1;
  if (a.scheduledAt < b.scheduledAt) return 1;
  if (a.adherenceEventId > b.adherenceEventId) return -1;
  if (a.adherenceEventId < b.adherenceEventId) return 1;
  return 0;
}

function cmpAscDose(a: AdherenceDose, b: AdherenceDose): number {
  if (a.scheduledAt < b.scheduledAt) return -1;
  if (a.scheduledAt > b.scheduledAt) return 1;
  return a.doseId.localeCompare(b.doseId);
}

function mkDoseKey(patientId: string, medicationId: string, scheduledAtIso: string): string {
  return `${patientId}::${medicationId}::${scheduledAtIso}`;
}

let idSeq = 1;
function newEventId(): string {
  idSeq += 1;
  return `ae_${idSeq.toString().padStart(6, "0")}`;
}

class InMemoryAdherenceQueries {
  private takenByDoseKey = new Map<string, { event: HistoryEvent; idempotencyKey: string }>();

  private fixtureDosesByDate = new Map<string, AdherenceDose[]>([
    [
      "2026-01-30",
      [
        { doseId: "dose_001", medicationId: "med_001", scheduledAt: "2026-01-30T08:00:00.000Z" },
        { doseId: "dose_002", medicationId: "med_001", scheduledAt: "2026-01-30T20:00:00.000Z" },
        { doseId: "dose_003", medicationId: "med_002", scheduledAt: "2026-01-30T09:00:00.000Z" },
      ],
    ],
    [
      "2026-01-29",
      [
        { doseId: "dose_004", medicationId: "med_001", scheduledAt: "2026-01-29T08:00:00.000Z" },
        { doseId: "dose_005", medicationId: "med_003", scheduledAt: "2026-01-29T12:00:00.000Z" },
      ],
    ],
  ]);

  private fixtureEvents: HistoryEvent[] = [
    {
      adherenceEventId: "ae_fixture_001",
      patientId: "patient_001",
      medicationId: "med_001",
      scheduledAt: "2026-01-30T08:00:00.000Z",
      takenAt: "2026-01-30T08:05:00.000Z",
      actor: { type: "PATIENT", userId: "user_patient_001" },
    },
    {
      adherenceEventId: "ae_fixture_002",
      patientId: "patient_001",
      medicationId: "med_003",
      scheduledAt: "2026-01-29T12:00:00.000Z",
      takenAt: "2026-01-29T12:10:00.000Z",
      actor: { type: "PATIENT", userId: "user_patient_001" },
    },
  ];

  getTodayDoses(patientId: string, date: string): TodayResponse {
    const base = (this.fixtureDosesByDate.get(date) ?? []).map((d) => ({ ...d }));

    const merged: AdherenceDose[] = base.map((d) => {
      const key = mkDoseKey(patientId, d.medicationId, d.scheduledAt);
      const taken = this.takenByDoseKey.get(key);
      if (!taken) return { ...d, event: null };
      return {
        ...d,
        event: {
          adherenceEventId: taken.event.adherenceEventId,
          status: "TAKEN",
          takenAt: taken.event.takenAt,
          actor: taken.event.actor,
        },
      };
    });

    for (const ev of this.fixtureEvents) {
      if (ev.patientId !== patientId) continue;
      if (isoDay(ev.scheduledAt) !== date) continue;
      const idx = merged.findIndex((d) => d.medicationId === ev.medicationId && d.scheduledAt === ev.scheduledAt);
      if (idx >= 0) {
        merged[idx] = {
          ...merged[idx],
          event: { adherenceEventId: ev.adherenceEventId, status: "TAKEN", takenAt: ev.takenAt, actor: ev.actor },
        };
      }
    }

    merged.sort(cmpAscDose);

    const monthMarks = Array.from(this.fixtureDosesByDate.keys())
      .sort()
      .map((d) => {
        const hasEvents =
          this.fixtureEvents.some((e) => e.patientId === patientId && isoDay(e.scheduledAt) === d) ||
          Array.from(this.takenByDoseKey.values()).some(
            (v) => v.event.patientId === patientId && isoDay(v.event.scheduledAt) === d
          );
        return { date: d, hasEvents };
      });

    return { date, doses: merged, monthMarks };
  }

  getHistory(params: { patientId: string; from: string; to: string; limit: number; cursor: string | null }): HistoryResponse {
    const { patientId, from, to, limit, cursor } = params;

    let cursorPayload: { lastSeenScheduledAt: string; lastSeenId: string } | null = null;
    if (cursor) {
      try {
        const decoded = decodeAndValidateHistoryCursor(cursor, { patientId, from, to });
        cursorPayload = { lastSeenScheduledAt: decoded.lastSeenScheduledAt, lastSeenId: decoded.lastSeenId };
      } catch (e) {
        if (e instanceof InvalidCursorError) {
          throw new ApplicationError(400, "INVALID_CURSOR", "Invalid cursor");
        }
        throw e;
      }
    }

    const fromDate = new Date(from + "T00:00:00.000Z");
    const toDateExclusive = new Date(to + "T00:00:00.000Z");
    toDateExclusive.setUTCDate(toDateExclusive.getUTCDate() + 1);

    const all: HistoryEvent[] = [];

    for (const ev of this.fixtureEvents) {
      if (ev.patientId !== patientId) continue;
      const d = new Date(ev.scheduledAt);
      if (d >= fromDate && d < toDateExclusive) all.push({ ...ev });
    }

    for (const { event } of this.takenByDoseKey.values()) {
      if (event.patientId !== patientId) continue;
      const d = new Date(event.scheduledAt);
      if (d >= fromDate && d < toDateExclusive) all.push({ ...event });
    }

    all.sort(cmpDesc);

    let filtered = all;
    if (cursorPayload) {
      const { lastSeenScheduledAt, lastSeenId } = cursorPayload;
      filtered = all.filter((e) => {
        if (e.scheduledAt < lastSeenScheduledAt) return true;
        if (e.scheduledAt > lastSeenScheduledAt) return false;
        return e.adherenceEventId < lastSeenId;
      });
    }

    const page = filtered.slice(0, limit);
    const hasMore = filtered.length > limit;

    const nextCursor =
      page.length > 0
        ? encodeHistoryCursor({
            patientId,
            from,
            to,
            lastSeenScheduledAt: page[page.length - 1]!.scheduledAt,
            lastSeenId: page[page.length - 1]!.adherenceEventId,
          })
        : "";

    return { events: page, nextCursor };
  }

  createTaken(params: {
    patientId: string;
    medicationId: string;
    scheduledAt: string;
    actor: { type: ActorType; userId: string };
    idempotencyKey: string;
    takenAt?: string;
  }): { adherenceEventId: string } {
    const scheduledAtIso = new Date(params.scheduledAt).toISOString();
    const key = mkDoseKey(params.patientId, params.medicationId, scheduledAtIso);

    const existing = this.takenByDoseKey.get(key);
    if (existing) {
      if (existing.idempotencyKey === params.idempotencyKey) {
        return { adherenceEventId: existing.event.adherenceEventId };
      }
      throw new ApplicationError(409, "DUPLICATE", "Duplicate");
    }

    const event: HistoryEvent = {
      adherenceEventId: newEventId(),
      patientId: params.patientId,
      medicationId: params.medicationId,
      scheduledAt: scheduledAtIso,
      takenAt: params.takenAt ?? new Date().toISOString(),
      actor: params.actor,
    };

    this.takenByDoseKey.set(key, { event, idempotencyKey: params.idempotencyKey });
    return { adherenceEventId: event.adherenceEventId };
  }
}

export const adherenceQueries = new InMemoryAdherenceQueries();
