import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createStudioPalette, resolvePaletteColors, setStudioRole } from "@/lib/colors";
import { serializeBackup } from "@/lib/colors/backup";
import { savedPaletteFromRow } from "@/lib/colors/saved-palette-row";

import { localPaletteStore, PaletteStoreError } from "../palette-store";
import { SavedPalettesView } from "../saved-palettes-view";
import { resetWorkspaceStoreForTests, workspaceActions } from "../workspace-store";

const LOCAL_KEY = "brandbite.colorStudio.palettes.v1";
const showToast = vi.fn();
const push = vi.fn();
let session: { user: { id: string } } | null = null;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/colors/saved",
}));
vi.mock("@/components/ui/toast-provider", () => ({ useToast: () => ({ showToast }) }));
vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => ({ data: session, isPending: false }) },
}));

function palette(name = "Ocean Breeze", hexes = ["#173b59", "#41c2d0", "#f6e5d5"]) {
  return createStudioPalette({ name, hexes, sourceTool: "generator" });
}

function seedLocal(...palettes: ReturnType<typeof palette>[]) {
  window.localStorage.setItem(LOCAL_KEY, JSON.stringify({ version: 1, palettes }));
}

function storedNames(): string[] {
  const raw = JSON.parse(window.localStorage.getItem(LOCAL_KEY) ?? '{"palettes":[]}');
  return raw.palettes.map((p: { name: string }) => p.name);
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  resetWorkspaceStoreForTests();
  session = null;
  showToast.mockClear();
  push.mockClear();
  vi.restoreAllMocks();
});

describe("localPaletteStore", () => {
  it("persists across reads", async () => {
    const p = palette();
    await localPaletteStore.createMany([p]);
    expect(await localPaletteStore.list()).toEqual([p]);
  });

  it("reports corrupt data and refuses to overwrite it", async () => {
    window.localStorage.setItem(LOCAL_KEY, "{oops");
    await expect(localPaletteStore.list()).rejects.toMatchObject({ kind: "corrupt" });
    await expect(localPaletteStore.createMany([palette()])).rejects.toBeInstanceOf(
      PaletteStoreError,
    );
    expect(window.localStorage.getItem(LOCAL_KEY)).toBe("{oops");
  });

  it("throws when the browser refuses a write", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    await expect(localPaletteStore.createMany([palette()])).rejects.toMatchObject({
      kind: "storage",
    });
  });
});

describe("guest collection", () => {
  it("explains where palettes live and offers a first palette", async () => {
    render(<SavedPalettesView />);
    expect(await screen.findByText("No saved palettes yet.")).toBeInTheDocument();
    expect(screen.getByText(/Saved in this browser/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create a palette" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export backup" })).toBeDisabled();
  });

  it("uses different text for no results, and clears filters", async () => {
    seedLocal(palette());
    render(<SavedPalettesView />);
    const search = await screen.findByLabelText("Search saved palettes");

    fireEvent.change(search, { target: { value: "zzz" } });
    expect(screen.getByText("No palettes match your search.")).toBeInTheDocument();
    expect(screen.queryByText("No saved palettes yet.")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByRole("button", { name: /^Ocean Breeze/ })).toBeInTheDocument();
  });

  it("filters by tool", async () => {
    seedLocal(palette("Generated"), {
      ...palette("From wheel"),
      sourceTool: "wheel",
    });
    render(<SavedPalettesView />);
    fireEvent.change(await screen.findByLabelText("Tool"), { target: { value: "wheel" } });
    expect(screen.getByRole("button", { name: /^From wheel/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Generated/ })).toBeNull();
  });

  it("deletes with undo, keeping the same content", async () => {
    seedLocal(palette());
    render(<SavedPalettesView />);
    fireEvent.click(await screen.findByRole("button", { name: "Delete palette", hidden: true }));
    await screen.findByText(/was deleted/);
    expect(storedNames()).toEqual([]);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    });
    expect(storedNames()).toEqual(["Ocean Breeze"]);
    expect(screen.queryByText(/was deleted/)).toBeNull();
  });

  it("renames through the detail panel and validates the name", async () => {
    seedLocal(palette());
    render(<SavedPalettesView />);
    fireEvent.click(await screen.findByRole("button", { name: "Rename Ocean Breeze" }));
    const input = screen.getByLabelText("Palette name");

    fireEvent.change(input, { target: { value: "   " } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save name" }));
    });
    expect(screen.getByText(/1 to 80 characters/)).toBeInTheDocument();
    expect(storedNames()).toEqual(["Ocean Breeze"]);

    fireEvent.change(input, { target: { value: "Coast" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save name" }));
    });
    expect(storedNames()).toEqual(["Coast"]);
  });

  it("duplicates under new ids", async () => {
    const source = palette();
    seedLocal(source);
    render(<SavedPalettesView />);
    await screen.findByRole("button", { name: `Rename ${source.name}` });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Duplicate", hidden: true }));
    });
    expect(storedNames()).toEqual(["Ocean Breeze copy", "Ocean Breeze"]);
    const raw = JSON.parse(window.localStorage.getItem(LOCAL_KEY) as string);
    expect(raw.palettes[0].id).not.toBe(source.id);
  });

  it("does not report success when saving fails", async () => {
    seedLocal(palette());
    render(<SavedPalettesView />);
    await screen.findByRole("button", { name: "Rename Ocean Breeze" });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Duplicate", hidden: true }));
    });
    expect(showToast).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/storage is full or blocked/);
  });

  it("assigns roles and persists them", async () => {
    const source = palette();
    seedLocal(source);
    render(<SavedPalettesView />);
    const textRole = await screen.findByLabelText("Text");
    await act(async () => {
      fireEvent.change(textRole, { target: { value: source.colors[0].id } });
    });
    const raw = JSON.parse(window.localStorage.getItem(LOCAL_KEY) as string);
    expect(raw.palettes[0].roles.text).toBe(source.colors[0].id);
  });

  it("explains corrupt data and resets only on request", async () => {
    window.localStorage.setItem(LOCAL_KEY, "{oops");
    render(<SavedPalettesView />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't be read/);
    expect(window.localStorage.getItem(LOCAL_KEY)).toBe("{oops");

    fireEvent.click(screen.getByRole("button", { name: "Clear saved data" }));
    expect(await screen.findByText("No saved palettes yet.")).toBeInTheDocument();
    expect(window.localStorage.getItem(LOCAL_KEY)).toBeNull();
  });
});

describe("backup import", () => {
  function chooseFile(content: string, name = "backup.json") {
    const file = new File([content], name, { type: "application/json" });
    // jsdom doesn't implement File.text().
    Object.defineProperty(file, "text", { value: async () => content });
    fireEvent.change(screen.getByLabelText("Backup file"), { target: { files: [file] } });
  }

  it("adds palettes without replacing existing ones", async () => {
    const existing = palette("Existing");
    seedLocal(existing);
    render(<SavedPalettesView />);
    await screen.findByLabelText("Backup file");

    chooseFile(serializeBackup([existing, palette("Imported")]));

    await waitFor(() => expect(storedNames().sort()).toEqual(["Existing", "Existing", "Imported"]));
    const ids = JSON.parse(window.localStorage.getItem(LOCAL_KEY) as string).palettes.map(
      (p: { id: string }) => p.id,
    );
    expect(new Set(ids).size).toBe(3);
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Imported 2 palettes" }),
    );
  });

  it.each([
    ["not JSON", "hello", /isn't a Color Studio backup/],
    ["the wrong shape", "{}", /invalid or unsupported/],
  ])("explains a file that is %s and imports nothing", async (_label, content, message) => {
    seedLocal(palette("Existing"));
    render(<SavedPalettesView />);
    await screen.findByLabelText("Backup file");
    chooseFile(content);
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(storedNames()).toEqual(["Existing"]);
  });
});

describe("opening a palette", () => {
  it("carries the palette and selected color to the tool", async () => {
    const source = palette();
    seedLocal(source);
    render(<SavedPalettesView />);
    fireEvent.click(await screen.findByRole("button", { name: "Select #41C2D0" }));
    fireEvent.click(screen.getByRole("button", { name: "Create shades" }));
    expect(push).toHaveBeenCalledWith("/colors/tailwind-color-generator");
    const stored = JSON.parse(
      window.sessionStorage.getItem("brandbite.colorStudio.workspace.v1") as string,
    );
    expect(stored.activePalette.id).toBe(source.id);
    expect(stored.selectedColorId).toBe(source.colors[1].id);
  });

  it("asks before replacing unsaved work", async () => {
    const working = palette("Work in progress");
    workspaceActions.load(working);
    workspaceActions.commit({ ...working, name: "Work in progress v2" });
    seedLocal(palette());
    render(<SavedPalettesView />);

    fireEvent.click(await screen.findByRole("button", { name: "Open in generator" }));
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByText("You have unsaved changes")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Keep working" }));
    expect(push).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Open in generator" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(push).toHaveBeenCalledWith("/colors/color-palette-generator");
  });

  it("saves unsaved work first when asked", async () => {
    const working = palette("Work in progress");
    workspaceActions.load(working);
    workspaceActions.commit({ ...working, name: "Work in progress v2" });
    seedLocal(palette());
    render(<SavedPalettesView />);

    fireEvent.click(await screen.findByRole("button", { name: "Open in generator" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    });
    expect(storedNames()).toContain("Work in progress v2");
    expect(push).toHaveBeenCalledWith("/colors/color-palette-generator");
  });
});

describe("signed-in collection", () => {
  const serverPalette = palette("On account");

  function mockAccountApi() {
    return vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      if (init?.method === "POST") {
        const body = JSON.parse(init.body as string);
        return new Response(JSON.stringify({ palettes: body.palettes }), { status: 201 });
      }
      return new Response(JSON.stringify({ palettes: [serverPalette] }), { status: 200 });
    });
  }

  beforeEach(() => {
    session = { user: { id: "u1" } };
  });

  it("reads from the account and says so", async () => {
    mockAccountApi();
    render(<SavedPalettesView />);
    expect(await screen.findByRole("button", { name: /^On account/ })).toBeInTheDocument();
    expect(screen.getByText(/Saved to your account/)).toBeInTheDocument();
  });

  it("never moves browser palettes without being asked", async () => {
    const fetchMock = mockAccountApi();
    seedLocal(palette("In browser"));
    render(<SavedPalettesView />);
    await screen.findByText(/This browser has 1 saved palette/);
    expect(fetchMock.mock.calls.every(([, init]) => init?.method !== "POST")).toBe(true);
    expect(storedNames()).toEqual(["In browser"]);
  });

  it("clears browser palettes only after the move succeeds", async () => {
    mockAccountApi();
    seedLocal(palette("In browser"));
    render(<SavedPalettesView />);
    const moveButton = await screen.findByRole("button", { name: "Move to my account" });
    await act(async () => {
      fireEvent.click(moveButton);
    });
    expect(window.localStorage.getItem(LOCAL_KEY)).toBeNull();
    expect(screen.getByRole("button", { name: /^In browser/ })).toBeInTheDocument();
    expect(screen.queryByText(/This browser has/)).toBeNull();
  });

  it("keeps browser palettes when the move fails", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) =>
      init?.method === "POST"
        ? new Response("{}", { status: 500 })
        : new Response(JSON.stringify({ palettes: [] }), { status: 200 }),
    );
    seedLocal(palette("In browser"));
    render(<SavedPalettesView />);
    const moveButton = await screen.findByRole("button", { name: "Move to my account" });
    await act(async () => {
      fireEvent.click(moveButton);
    });
    expect(storedNames()).toEqual(["In browser"]);
    expect(screen.getByRole("alert")).toHaveTextContent(/Couldn't reach your account/);
  });

  it("shows a load failure without claiming there are no palettes", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    render(<SavedPalettesView />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/Couldn't reach your account/);
    expect(screen.queryByText("No saved palettes yet.")).toBeNull();
    expect(screen.queryByRole("button", { name: "Clear saved data" })).toBeNull();
  });
});

describe("savedPaletteFromRow", () => {
  const row = {
    id: "r1",
    name: "Row",
    colors: ["#ABC", "#173b59"] as unknown,
    roles: null as unknown,
    tags: [],
    source: "GENERATOR" as string | null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-02"),
  };

  it("converts legacy hex arrays and tool names", () => {
    const palette = savedPaletteFromRow(row);
    expect(palette?.colors.map((c) => c.hex)).toEqual(["#aabbcc", "#173b59"]);
    expect(new Set(palette?.colors.map((c) => c.id)).size).toBe(2);
    expect(palette?.sourceTool).toBe("generator");
  });

  it("skips unreadable colors, and rejects a row with none", () => {
    expect(savedPaletteFromRow({ ...row, colors: ["nope", "#000000"] })?.colors).toHaveLength(1);
    expect(savedPaletteFromRow({ ...row, colors: ["nope"] })).toBeNull();
    expect(savedPaletteFromRow({ ...row, colors: "nope" })).toBeNull();
  });

  it("drops roles pointing at missing colors", () => {
    const palette = savedPaletteFromRow({
      ...row,
      colors: [{ id: "a", hex: "#000000", locked: true }],
      roles: { text: "a", accent: "missing" },
    });
    expect(palette?.roles).toEqual({ text: "a" });
    expect(palette?.colors[0].locked).toBe(true);
  });
});

describe("resolvePaletteColors", () => {
  it("prefers assigned roles", () => {
    const source = palette();
    const withRole = setStudioRole(source, "background", source.colors[1].id);
    expect(resolvePaletteColors(withRole).background).toBe("#41c2d0");
  });

  it("falls back to a white background and readable text", () => {
    const resolved = resolvePaletteColors(palette());
    expect(resolved.background).toBe("#ffffff");
    expect(resolved.surface).toBe("#f6e5d5");
    expect(resolved.text).toBe("#173b59");
  });

  it("uses black or white text when no palette color is readable", () => {
    const resolved = resolvePaletteColors(palette("Mid", ["#808080", "#8a8a8a"]));
    expect(["#000000", "#ffffff"]).toContain(resolved.text);
  });

  it("computes button text instead of assuming white", () => {
    const source = palette("Light", ["#ffe680", "#ffffff"]);
    const withPrimary = setStudioRole(source, "primary", source.colors[0].id);
    expect(resolvePaletteColors(withPrimary).onPrimary).toBe("#000000");
  });
});
