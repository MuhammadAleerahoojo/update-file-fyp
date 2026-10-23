import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ result: { data: [{ id: "a1" }] as unknown[] | null, error: null as unknown } }));

vi.mock("@/lib/supabase", () => {
  const chain = {
    update: () => chain,
    eq: () => chain,
    select: () => Promise.resolve(state.result),
  };
  return { supabase: { from: () => chain } };
});

import { cancelAppointment, isActionable, normalizeStatus, rescheduleAppointment } from "./appointments";

beforeEach(() => {
  state.result = { data: [{ id: "a1" }], error: null };
});

describe("normalizeStatus", () => {
  it("maps legacy and alternate spellings", () => {
    expect(normalizeStatus("canceled")).toBe("cancelled");
    expect(normalizeStatus("Upcoming")).toBe("scheduled");
    expect(normalizeStatus("no-show")).toBe("no_show");
    expect(normalizeStatus(null)).toBe("scheduled");
    expect(normalizeStatus("???")).toBe("scheduled");
  });
});

describe("isActionable", () => {
  it("only allows future scheduled appointments", () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const past = new Date(Date.now() - 86_400_000).toISOString();
    expect(isActionable("scheduled", future)).toBe(true);
    expect(isActionable("scheduled", past)).toBe(false);
    expect(isActionable("cancelled", future)).toBe(false);
    expect(isActionable("scheduled", "nope")).toBe(false);
  });
});

describe("cancel / reschedule", () => {
  it("succeeds when a row was updated", async () => {
    expect((await cancelAppointment("a1")).ok).toBe(true);
    expect((await rescheduleAppointment("a1", new Date().toISOString())).ok).toBe(true);
  });

  it("fails when RLS filtered the update to zero rows", async () => {
    state.result = { data: [], error: null };
    const res = await cancelAppointment("a1");
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/not found|can't be changed/);
  });

  it("explains a double-booking unique violation", async () => {
    state.result = { data: null, error: { code: "23505", message: "duplicate key" } };
    const res = await rescheduleAppointment("a1", new Date().toISOString());
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/already booked/);
  });

  it("surfaces other database errors", async () => {
    state.result = { data: null, error: { code: "XX000", message: "boom" } };
    const res = await cancelAppointment("a1");
    expect(res).toEqual({ ok: false, message: "Could not cancel the appointment: boom" });
  });
});
