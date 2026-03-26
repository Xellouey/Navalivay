import { describe, expect, it } from "vitest";
import {
  formatBusinessPeriodLabel,
  formatBusinessPeriodTitle,
  getBusinessYear,
} from "@/utils/businessTime";

describe("businessTime", () => {
  it("formats the current business day in Minsk instead of local browser time", () => {
    const referenceDate = new Date("2026-03-25T21:30:00.000Z");

    expect(formatBusinessPeriodLabel("today", 0, referenceDate)).toContain("26 марта 2026");
    expect(formatBusinessPeriodLabel("today", 0, referenceDate)).not.toContain("25 марта 2026");
  });

  it("shifts daily labels by offset using Minsk calendar days", () => {
    const referenceDate = new Date("2026-03-25T21:30:00.000Z");

    expect(formatBusinessPeriodLabel("today", -1, referenceDate)).toContain("25 марта 2026");
  });

  it("uses the Minsk year on the UTC year boundary", () => {
    const referenceDate = new Date("2025-12-31T22:30:00.000Z");

    expect(getBusinessYear(referenceDate)).toBe(2026);
    expect(formatBusinessPeriodLabel("month", 0, referenceDate)).toContain("2026");
    expect(formatBusinessPeriodLabel("month", 0, referenceDate).toLowerCase()).toContain("январ");
    expect(formatBusinessPeriodTitle("year", 0, referenceDate)).toBe("2026 год");
  });
});
