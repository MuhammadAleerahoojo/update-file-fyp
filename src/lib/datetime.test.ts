import { describe, expect, it } from "vitest";
import { ageFromDateOfBirth, toDateTimeParts, toTimestamp } from "./datetime";

describe("toTimestamp", () => {
  it("keeps wall-clock time (round-trips through toDateTimeParts)", () => {
    const iso = toTimestamp("2030-06-15", "09:30");
    expect(iso).not.toBeNull();
    expect(toDateTimeParts(iso)).toEqual({ date: "2030-06-15", time: "09:30" });
  });

  it.each([
    ["", "09:00"],
    ["2030-06-15", ""],
    ["not-a-date", "09:00"],
    ["2030-06-15", "ab:cd"],
  ])("rejects missing/garbled input (%s, %s)", (date, time) => {
    expect(toTimestamp(date, time)).toBeNull();
  });

  it("rejects dates that would silently roll over", () => {
    expect(toTimestamp("2030-02-30", "09:00")).toBeNull();
    expect(toTimestamp("2030-13-01", "09:00")).toBeNull();
    expect(toTimestamp("2030-06-15", "25:00")).toBeNull();
    expect(toTimestamp("2030-06-15", "09:75")).toBeNull();
  });

  it("accepts a real leap day", () => {
    expect(toTimestamp("2032-02-29", "10:00")).not.toBeNull();
  });
});

describe("ageFromDateOfBirth", () => {
  it("returns null for empty, invalid and future dates", () => {
    expect(ageFromDateOfBirth(null)).toBeNull();
    expect(ageFromDateOfBirth("garbage")).toBeNull();
    expect(ageFromDateOfBirth("2999-01-01")).toBeNull();
  });
});
