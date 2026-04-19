// -----------------------------------------------------------------------------
// @file: lib/ratings/__tests__/creative-ratings.test.ts
// @purpose: Unit tests for getCreativeRatingSummary and the batched variant.
//           Prisma is mocked; the helper is pure business logic around
//           aggregate / groupBy results.
// -----------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    creativeRating: {
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import {
  EMPTY_RATING_SUMMARY,
  getCreativeRatingSummaries,
  getCreativeRatingSummary,
} from "@/lib/ratings/creative-ratings";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getCreativeRatingSummary", () => {
  it("returns EMPTY_RATING_SUMMARY when the creative has no ratings", async () => {
    mockPrisma.creativeRating.aggregate.mockResolvedValueOnce({
      _count: { _all: 0 },
      _avg: { quality: null, communication: null, speed: null },
    });

    const result = await getCreativeRatingSummary("c1");
    expect(result).toEqual(EMPTY_RATING_SUMMARY);
    expect(result.overall).toBeNull();
  });

  it("computes overall as the mean of the three dimensions", async () => {
    mockPrisma.creativeRating.aggregate.mockResolvedValueOnce({
      _count: { _all: 4 },
      _avg: { quality: 5, communication: 4, speed: 3 },
    });

    const result = await getCreativeRatingSummary("c1");
    expect(result.count).toBe(4);
    expect(result.quality).toBe(5);
    expect(result.communication).toBe(4);
    expect(result.speed).toBe(3);
    expect(result.overall).toBe(4); // (5 + 4 + 3) / 3
  });
});

describe("getCreativeRatingSummaries (batched)", () => {
  it("returns EMPTY_RATING_SUMMARY for every id when the DB has no rows", async () => {
    mockPrisma.creativeRating.groupBy.mockResolvedValueOnce([]);
    const result = await getCreativeRatingSummaries(["a", "b"]);
    expect(result.get("a")).toEqual(EMPTY_RATING_SUMMARY);
    expect(result.get("b")).toEqual(EMPTY_RATING_SUMMARY);
  });

  it("populates summaries for creatives that have ratings, leaves others empty", async () => {
    mockPrisma.creativeRating.groupBy.mockResolvedValueOnce([
      {
        creativeId: "a",
        _count: { _all: 2 },
        _avg: { quality: 4, communication: 5, speed: 3 },
      },
    ]);
    const result = await getCreativeRatingSummaries(["a", "b"]);
    expect(result.get("a")?.count).toBe(2);
    expect(result.get("a")?.overall).toBe(4);
    expect(result.get("b")).toEqual(EMPTY_RATING_SUMMARY);
  });

  it("short-circuits on empty input without hitting the DB", async () => {
    const result = await getCreativeRatingSummaries([]);
    expect(result.size).toBe(0);
    expect(mockPrisma.creativeRating.groupBy).not.toHaveBeenCalled();
  });
});
