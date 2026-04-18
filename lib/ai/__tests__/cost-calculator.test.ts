// -----------------------------------------------------------------------------
// @file: lib/ai/__tests__/cost-calculator.test.ts
// @purpose: claimAiGeneration returns existing record on idempotency-key reuse,
//           without creating a second row or re-debiting tokens
// -----------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock prisma — we track create/findUnique calls to prove no double-debit
// ---------------------------------------------------------------------------

const existingGeneration = {
  id: "gen-existing",
  userId: "user-1",
  companyId: "co-1",
  status: "COMPLETED",
  tokenCost: 2,
  outputImageUrl: "https://example.com/x.png",
  outputParams: null,
  createdAt: new Date("2025-01-01T00:00:00Z"),
  provider: "openai",
  model: "dall-e-3",
  toolType: "IMAGE_GENERATION",
  idempotencyKey: "11111111-1111-1111-1111-111111111111",
};

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    aiGeneration: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    company: {
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    tokenLedger: {
      create: vi.fn(),
    },
    aiToolConfig: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { claimAiGeneration, IdempotencyKeyConflictError } from "@/lib/ai/cost-calculator";

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.$transaction.mockImplementation(
    async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
  );
});

describe("claimAiGeneration", () => {
  it("returns existing record without debiting when idempotency key was already used", async () => {
    mockPrisma.aiGeneration.findUnique.mockResolvedValueOnce(existingGeneration);

    const result = await claimAiGeneration({
      idempotencyKey: "11111111-1111-1111-1111-111111111111",
      userId: "user-1",
      companyId: "co-1",
      toolType: "IMAGE_GENERATION",
      prompt: "retry prompt",
      inputParams: {},
      cost: 2,
    });

    expect(result.reused).toBe(true);
    expect(result.generation.id).toBe("gen-existing");
    // No new row, no debit
    expect(mockPrisma.aiGeneration.create).not.toHaveBeenCalled();
    expect(mockPrisma.company.update).not.toHaveBeenCalled();
    expect(mockPrisma.tokenLedger.create).not.toHaveBeenCalled();
  });

  it("throws IdempotencyKeyConflictError when key belongs to another company", async () => {
    mockPrisma.aiGeneration.findUnique.mockResolvedValueOnce({
      ...existingGeneration,
      companyId: "co-other",
    });

    await expect(
      claimAiGeneration({
        idempotencyKey: "11111111-1111-1111-1111-111111111111",
        userId: "user-1",
        companyId: "co-1",
        toolType: "IMAGE_GENERATION",
        prompt: "p",
        inputParams: {},
        cost: 2,
      }),
    ).rejects.toBeInstanceOf(IdempotencyKeyConflictError);

    expect(mockPrisma.aiGeneration.create).not.toHaveBeenCalled();
  });

  it("creates new record and debits tokens when no idempotency key provided", async () => {
    mockPrisma.aiGeneration.create.mockResolvedValueOnce({
      ...existingGeneration,
      id: "gen-new",
      idempotencyKey: null,
    });
    mockPrisma.company.findUniqueOrThrow.mockResolvedValueOnce({ tokenBalance: 100 });

    const result = await claimAiGeneration({
      idempotencyKey: null,
      userId: "user-1",
      companyId: "co-1",
      toolType: "IMAGE_GENERATION",
      prompt: "fresh prompt",
      inputParams: {},
      cost: 2,
    });

    expect(result.reused).toBe(false);
    expect(result.generation.id).toBe("gen-new");
    expect(mockPrisma.aiGeneration.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.company.update).toHaveBeenCalledWith({
      where: { id: "co-1" },
      data: { tokenBalance: 98 },
    });
    expect(mockPrisma.tokenLedger.create).toHaveBeenCalledTimes(1);
  });

  it("recovers from unique-constraint race by re-fetching the winning row", async () => {
    // First lookup: no existing row (racing with another request)
    mockPrisma.aiGeneration.findUnique.mockResolvedValueOnce(null);
    // Create races and fails with unique violation on idempotencyKey
    const uniqueError = Object.assign(new Error("unique"), {
      code: "P2002",
      meta: { target: ["idempotencyKey"] },
    });
    mockPrisma.$transaction.mockRejectedValueOnce(uniqueError);
    // Recovery lookup: winner is now visible
    mockPrisma.aiGeneration.findUnique.mockResolvedValueOnce(existingGeneration);

    const result = await claimAiGeneration({
      idempotencyKey: "11111111-1111-1111-1111-111111111111",
      userId: "user-1",
      companyId: "co-1",
      toolType: "IMAGE_GENERATION",
      prompt: "racing prompt",
      inputParams: {},
      cost: 2,
    });

    expect(result.reused).toBe(true);
    expect(result.generation.id).toBe("gen-existing");
    // The losing transaction did not commit a ledger entry
    expect(mockPrisma.tokenLedger.create).not.toHaveBeenCalled();
  });
});
