// -----------------------------------------------------------------------------
// @file: tests/integration/saved-palettes.test.ts
// @purpose: Color Studio account palettes against a real database: ownership,
//           validation, the per-user limit, and reading rows saved before the
//           Color Studio fields existed.
// -----------------------------------------------------------------------------

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetUser } = vi.hoisted(() => ({ mockGetUser: vi.fn() }));

vi.mock("@/lib/auth", () => ({
  getCurrentUserOrThrow: () => mockGetUser(),
}));

import { DELETE, PATCH } from "@/app/api/colors/palettes/[paletteId]/route";
import { GET, POST } from "@/app/api/colors/palettes/route";
import { createStudioPalette, setStudioRole } from "@/lib/colors";
import { MAX_SAVED_PALETTES } from "@/lib/colors/palette-schema";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "./helpers/db";
import { createUser } from "./helpers/fixtures";

function jsonReq(method: string, body: unknown) {
  return new NextRequest("http://localhost/test", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const context = (paletteId: string) => ({ params: Promise.resolve({ paletteId }) });

function palette(name = "Ocean") {
  return createStudioPalette({
    name,
    hexes: ["#173B59", "#41c2d0"],
    sourceTool: "generator",
  });
}

async function actAs() {
  const user = await createUser({ role: "CUSTOMER" });
  mockGetUser.mockResolvedValue({ id: user.id, email: "u@test.local", role: "CUSTOMER" });
  return user;
}

beforeEach(async () => {
  await prisma.savedPalette.deleteMany();
  await resetDatabase();
  mockGetUser.mockReset();
});

describe("account palettes", () => {
  it("creates a palette and lists it with roles intact", async () => {
    await actAs();
    const source = palette();
    const withRole = setStudioRole(source, "text", source.colors[0].id);

    const created = await POST(jsonReq("POST", { palette: withRole }));
    expect(created.status).toBe(201);
    const { palettes } = await created.json();
    expect(palettes[0].id).not.toBe(source.id);
    expect(palettes[0].colors[0].hex).toBe("#173b59");

    const list = await (await GET()).json();
    expect(list.palettes).toHaveLength(1);
    expect(list.palettes[0].roles.text).toBe(list.palettes[0].colors[0].id);
    expect(list.palettes[0].sourceTool).toBe("generator");
  });

  it("creates several palettes in one request", async () => {
    await actAs();
    const res = await POST(jsonReq("POST", { palettes: [palette("A"), palette("B")] }));
    expect(res.status).toBe(201);
    expect((await res.json()).palettes).toHaveLength(2);
  });

  it("reads rows saved before Color Studio", async () => {
    const user = await actAs();
    await prisma.savedPalette.create({
      data: {
        name: "Legacy",
        colors: ["#f15b2b", "#424143"],
        source: "EXTRACTOR",
        createdById: user.id,
      },
    });

    const [legacy] = (await (await GET()).json()).palettes;
    expect(legacy.colors.map((c: { hex: string }) => c.hex)).toEqual(["#f15b2b", "#424143"]);
    expect(legacy.colors.every((c: { id: string }) => c.id)).toBe(true);
    expect(legacy.sourceTool).toBe("image");
    expect(legacy.roles).toEqual({});
    expect(legacy.tags).toEqual([]);
  });

  it("updates a legacy row into the new form", async () => {
    const user = await actAs();
    await prisma.savedPalette.create({
      data: { name: "Legacy", colors: ["#f15b2b"], source: "WHEEL", createdById: user.id },
    });
    const [legacy] = (await (await GET()).json()).palettes;

    const res = await PATCH(
      jsonReq("PATCH", { palette: setStudioRole(legacy, "accent", legacy.colors[0].id) }),
      context(legacy.id),
    );
    expect(res.status).toBe(200);
    const { palette: updated } = await res.json();
    expect(updated.roles.accent).toBe(updated.colors[0].id);
    expect(updated.sourceTool).toBe("wheel");
  });

  it.each([
    ["an invalid color", { colors: [{ id: "a", hex: "url(evil)", locked: false }] }],
    ["an alpha color", { colors: [{ id: "a", hex: "#ff642680", locked: false }] }],
    ["no colors", { colors: [] }],
    ["a blank name", { name: "  " }],
    ["a long name", { name: "x".repeat(81) }],
  ])("rejects %s", async (_label, change) => {
    await actAs();
    const res = await POST(jsonReq("POST", { palette: { ...palette(), ...change } }));
    expect(res.status).toBe(400);
    expect(await prisma.savedPalette.count()).toBe(0);
  });

  it("enforces the per-user limit", async () => {
    const user = await actAs();
    await prisma.savedPalette.createMany({
      data: Array.from({ length: MAX_SAVED_PALETTES }, (_, i) => ({
        name: `P${i}`,
        colors: ["#000000"],
        createdById: user.id,
      })),
    });

    const res = await POST(jsonReq("POST", { palette: palette() }));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("LIMIT_REACHED");
    expect(await prisma.savedPalette.count()).toBe(MAX_SAVED_PALETTES);
  });

  it("answers 401 when signed out", async () => {
    mockGetUser.mockRejectedValue(Object.assign(new Error("no"), { code: "UNAUTHENTICATED" }));
    expect((await GET()).status).toBe(401);
    expect((await POST(jsonReq("POST", { palette: palette() }))).status).toBe(401);
    expect((await DELETE(jsonReq("DELETE", {}), context("x"))).status).toBe(401);
  });
});

describe("palette ownership", () => {
  async function otherUsersPalette() {
    const owner = await createUser({ role: "CUSTOMER" });
    return prisma.savedPalette.create({
      data: { name: "Theirs", colors: ["#000000"], createdById: owner.id },
    });
  }

  it("hides another user's palettes from the list", async () => {
    await otherUsersPalette();
    await actAs();
    expect((await (await GET()).json()).palettes).toEqual([]);
  });

  it("cannot update another user's palette", async () => {
    const theirs = await otherUsersPalette();
    await actAs();
    const res = await PATCH(jsonReq("PATCH", { palette: palette("Stolen") }), context(theirs.id));
    expect(res.status).toBe(404);
    const after = await prisma.savedPalette.findUniqueOrThrow({ where: { id: theirs.id } });
    expect(after.name).toBe("Theirs");
  });

  it("cannot delete another user's palette", async () => {
    const theirs = await otherUsersPalette();
    await actAs();
    const res = await DELETE(jsonReq("DELETE", {}), context(theirs.id));
    expect(res.status).toBe(404);
    expect(await prisma.savedPalette.count({ where: { id: theirs.id } })).toBe(1);
  });

  it("deletes the user's own palette", async () => {
    await actAs();
    const { palettes } = await (await POST(jsonReq("POST", { palette: palette() }))).json();
    const res = await DELETE(jsonReq("DELETE", {}), context(palettes[0].id));
    expect(res.status).toBe(200);
    expect(await prisma.savedPalette.count()).toBe(0);
  });
});
