import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BrandGuideEditor } from "@/components/brand/brand-guide-editor";

vi.mock("@/components/ui/toast-provider", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

const BRAND = {
  id: "b1",
  name: "Northwind",
  tagline: "Coffee that shows up",
  description: null,
  audience: null,
  values: ["reliable", "warm"],
  references: null,
  toneWords: ["friendly"],
  voiceNotes: null,
  voiceDo: [],
  voiceDont: [],
  wordsToUse: [],
  wordsToAvoid: [],
  sampleCopy: null,
  colors: [{ id: "c1", hex: "#1f3a5f", name: "Harbor", role: "primary" }],
  fonts: [{ id: "f1", name: "Inter", role: "body" }],
  imageryNotes: null,
};

const LOGO = {
  id: "a1",
  kind: "LOGO_PRIMARY",
  background: "ANY",
  label: null,
  name: "logo.svg",
  sizeBytes: 2048,
  previewUrl: "https://r2.example.com/logo.svg?sig=1",
};

type Call = { method: string; url: string; body: unknown };

function mockApi(options: { canEdit?: boolean; assets?: unknown[] } = {}) {
  const calls: Call[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const method = init?.method ?? "GET";
    const url = String(input);
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : (init?.body ?? null);
    calls.push({ method, url, body });

    if (url === "/api/customer/brand" && method === "GET") {
      return Response.json({
        brand: BRAND,
        assets: options.assets ?? [],
        canEdit: options.canEdit ?? true,
      });
    }
    if (url === "/api/customer/brand" && method === "PATCH") {
      return Response.json({ brand: { ...BRAND, ...(body as object) } });
    }
    if (url === "/api/customer/brand/assets" && method === "POST") {
      return Response.json({
        assetId: "a2",
        uploadUrl: "https://r2.example.com/put",
        method: "PUT",
        contentType: "application/octet-stream",
      });
    }
    if (url === "https://r2.example.com/put") return new Response(null, { status: 200 });
    if (url.endsWith("/complete")) {
      return Response.json({ asset: { ...LOGO, id: "a2", name: "mark.ai", previewUrl: null } });
    }
    if (method === "DELETE") return Response.json({ success: true });
    return Response.json({});
  });
  return calls;
}

afterEach(() => vi.restoreAllMocks());

const openTab = (name: string) => fireEvent.click(screen.getByRole("tab", { name }));

describe("BrandGuideEditor", () => {
  it("shows the saved guide, with lists one per line", async () => {
    mockApi();
    render(<BrandGuideEditor />);

    expect(await screen.findByLabelText("Brand name")).toHaveValue("Northwind");
    expect(screen.getByLabelText("Values")).toHaveValue("reliable\nwarm");
    expect(screen.getByRole("button", { name: "Save brand guide" })).toBeDisabled();

    openTab("Brand language");
    expect(screen.getByLabelText("Tone words")).toHaveValue("friendly");
    expect(screen.queryByLabelText("Brand name")).not.toBeInTheDocument();

    openTab("Visual identity");
    expect(screen.getByLabelText("Color 1 hex code")).toHaveValue("#1f3a5f");
    expect(screen.getByLabelText("Font 1 name")).toHaveValue("Inter");
  });

  it("saves edits, sending lists as arrays", async () => {
    const calls = mockApi();
    render(<BrandGuideEditor />);

    await screen.findByLabelText("Brand name");
    openTab("Brand language");
    fireEvent.change(screen.getByLabelText("Tone words"), {
      target: { value: "friendly\n direct \n\n" },
    });
    const save = screen.getByRole("button", { name: "Save brand guide" });
    expect(save).toBeEnabled();
    fireEvent.click(save);

    await waitFor(() => expect(calls.some((c) => c.method === "PATCH")).toBe(true));
    const patch = calls.find((c) => c.method === "PATCH")!.body as Record<string, unknown>;
    expect(patch.toneWords).toEqual(["friendly", "direct"]);
    expect(patch.values).toEqual(["reliable", "warm"]);
    expect(patch.name).toBe("Northwind");
    await waitFor(() => expect(save).toBeDisabled());
  });

  it("won't save a color without a valid hex", async () => {
    const calls = mockApi();
    render(<BrandGuideEditor />);

    await screen.findByLabelText("Brand name");
    openTab("Visual identity");
    fireEvent.change(screen.getByLabelText("Color 1 hex code"), {
      target: { value: "orange" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save brand guide" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/valid hex code/);
    expect(calls.some((c) => c.method === "PATCH")).toBe(false);
  });

  it("adds and removes colors and fonts", async () => {
    mockApi();
    render(<BrandGuideEditor />);

    await screen.findByLabelText("Brand name");
    openTab("Visual identity");
    fireEvent.click(screen.getByRole("button", { name: "Add color" }));
    expect(screen.getByLabelText("Color 2 hex code")).toHaveValue("#000000");
    fireEvent.click(screen.getByRole("button", { name: "Remove color 1" }));
    expect(screen.queryByLabelText("Color 2 hex code")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove font 1" }));
    expect(screen.getByText("No fonts yet.")).toBeInTheDocument();
  });

  it("is read-only for members who can't edit, but still lets them download", async () => {
    mockApi({ canEdit: false, assets: [LOGO] });
    render(<BrandGuideEditor />);

    expect(await screen.findByLabelText("Brand name")).toHaveAttribute("readonly");
    expect(screen.getByText("You can read this guide")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save brand guide" })).not.toBeInTheDocument();
    openTab("Visual identity");
    expect(screen.queryByRole("button", { name: "Add color" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove color 1" })).not.toBeInTheDocument();
    openTab("Files & collaboration");
    expect(screen.queryByRole("button", { name: "Upload files" })).not.toBeInTheDocument();
    expect(screen.queryByText("Ask a colleague")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Primary logo: logo.svg" })).toBeInTheDocument();
  });

  it("uploads a file straight to storage, then confirms it", async () => {
    const calls = mockApi();
    const { container } = render(<BrandGuideEditor />);
    await screen.findByLabelText("Brand name");
    openTab("Files & collaboration");

    const file = new File(["%!PS"], "mark.ai", { type: "application/postscript" });
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [file] },
    });

    expect(await screen.findByText("mark.ai")).toBeInTheDocument();
    const start = calls.find((c) => c.url === "/api/customer/brand/assets")!;
    expect(start.body).toEqual({ name: "mark.ai", sizeBytes: 4, kind: "LOGO_PRIMARY" });
    expect(calls.some((c) => c.url === "https://r2.example.com/put" && c.method === "PUT")).toBe(
      true,
    );
    expect(calls.some((c) => c.url === "/api/customer/brand/assets/a2/complete")).toBe(true);
  });

  it("refuses a file type it doesn't accept without calling the server", async () => {
    const calls = mockApi();
    const { container } = render(<BrandGuideEditor />);
    await screen.findByLabelText("Brand name");
    openTab("Files & collaboration");

    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [new File(["x"], "run.exe")] },
    });

    expect(await screen.findByText(/run\.exe: That file type isn't supported/)).toBeInTheDocument();
    expect(calls.some((c) => c.method === "POST")).toBe(false);
  });

  it("asks before removing a file", async () => {
    const calls = mockApi({ assets: [LOGO] });
    render(<BrandGuideEditor />);

    await screen.findByLabelText("Brand name");
    openTab("Files & collaboration");
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.getByText("Remove this file?")).toBeInTheDocument();
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);

    const buttons = screen.getAllByRole("button", { name: "Remove" });
    fireEvent.click(buttons[buttons.length - 1]!);
    await waitFor(() => expect(screen.queryByText("logo.svg")).not.toBeInTheDocument());
    expect(calls.some((c) => c.method === "DELETE" && c.url.endsWith("/assets/a1"))).toBe(true);
  });

  it("counts the essentials and opens the tab of the next one", async () => {
    mockApi();
    render(<BrandGuideEditor />);

    // Tone words, a color and a font are saved; the description and a primary logo are not.
    expect(await screen.findByText("3 of 5 essentials complete")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Brand guide progress" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Describe what you do" })).toBeInTheDocument();
  });

  it("points at the primary logo when that is all that's missing", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
      String(input) === "/api/customer/brand"
        ? Response.json({
            brand: { ...BRAND, description: "We roast coffee." },
            assets: [],
            canEdit: true,
          })
        : Response.json({}),
    );
    render(<BrandGuideEditor />);

    expect(await screen.findByText("4 of 5 essentials complete")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add a primary logo" }));
    expect(screen.getByRole("tab", { name: "Files & collaboration" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("button", { name: "Upload files" })).toBeInTheDocument();
  });

  it("says the guide is ready when all five are there", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
      String(input) === "/api/customer/brand"
        ? Response.json({
            brand: { ...BRAND, description: "We roast coffee." },
            assets: [LOGO],
            canEdit: true,
          })
        : Response.json({}),
    );
    render(<BrandGuideEditor />);

    expect(await screen.findByText("5 of 5 essentials complete")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your brand guide is ready" })).toBeInTheDocument();
  });

  it("opens the tab that holds the problem when a save is refused", async () => {
    const calls = mockApi();
    render(<BrandGuideEditor />);

    fireEvent.change(await screen.findByLabelText("Brand name"), { target: { value: "N" } });
    openTab("Brand language");
    fireEvent.click(screen.getByRole("button", { name: "Save brand guide" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Give the brand a name.");
    expect(screen.getByLabelText("Brand name")).toBeInTheDocument();
    expect(calls.some((c) => c.method === "PATCH")).toBe(false);
  });

  it("keeps a font's link behind Edit link", async () => {
    mockApi();
    render(<BrandGuideEditor />);
    await screen.findByLabelText("Brand name");
    openTab("Visual identity");

    expect(screen.queryByLabelText("Font 1 link")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add link for font 1" }));
    fireEvent.change(screen.getByLabelText("Font 1 link"), {
      target: { value: "https://fonts.google.com/specimen/Inter" },
    });
    expect(screen.getByRole("button", { name: "Edit link for font 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save brand guide" })).toBeEnabled();
  });
});
