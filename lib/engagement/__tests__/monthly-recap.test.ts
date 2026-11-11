import { describe, expect, it } from "vitest";

import {
  agencyEquivalentUsd,
  calculatorHours,
  previousMonth,
  recapShareText,
} from "../monthly-recap";

describe("monthly recap", () => {
  it("takes the calendar month before now, in UTC", () => {
    const month = previousMonth(new Date("2026-11-01T06:00:00Z"));
    expect(month.key).toBe("2026-10");
    expect(month.label).toBe("October 2026");
    expect(month.start.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(month.end.toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(previousMonth(new Date("2027-01-15T00:00:00Z")).label).toBe("December 2026");
  });

  it("finds typical hours for a service in the cost calculator", () => {
    expect(calculatorHours("Logo Design")).toBe(20);
    expect(calculatorHours("Social media carousel post")).toBe(2);
    expect(calculatorHours("Something unusual")).toBeNull();
  });

  it("estimates agency price from hours at the calculator's US agency rate", () => {
    // 20h (catalog) + 20h (logo, from the calculator) = 40h × $150
    expect(
      agencyEquivalentUsd([
        { serviceName: "Custom thing", estimatedHours: 20 },
        { serviceName: "Logo Design", estimatedHours: null },
      ]),
    ).toBe(6000);
  });

  it("gives no estimate when nothing can be estimated", () => {
    expect(agencyEquivalentUsd([{ serviceName: "Mystery", estimatedHours: null }])).toBeNull();
    expect(agencyEquivalentUsd([])).toBeNull();
  });

  it("writes a share line that calls the figure an estimate", () => {
    const text = recapShareText(
      {
        monthKey: "2026-10",
        monthLabel: "October 2026",
        monthName: "October",
        jobsDelivered: 12,
        tokensUsed: 96,
        agencyEquivalentUsd: 4800,
      },
      "Acme Studio",
    );
    expect(text).toBe(
      "Acme Studio's October 2026 with brandbite: 12 requests delivered, about $4,800 of agency work (estimate). https://brandbite.studio",
    );
  });
});
