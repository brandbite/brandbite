import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BrandGuidePanel, TicketBrandGuide } from "@/components/brand/ticket-brand-guide";

const EMPTY_BRAND = {
  name: "Northwind",
  tagline: null,
  description: null,
  audience: null,
  values: [],
  references: null,
  toneWords: [],
  voiceNotes: null,
  voiceDo: [],
  voiceDont: [],
  wordsToUse: [],
  wordsToAvoid: [],
  sampleCopy: null,
  colors: [],
  fonts: [],
  imageryNotes: null,
};

const FILE = {
  id: "a1",
  kind: "LOGO_PRIMARY",
  background: "DARK",
  name: "logo.ai",
  sizeBytes: 4096,
  previewUrl: null,
};

function mockApi(payload: unknown, status = 200) {
  const calls: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    calls.push(url);
    if (url.endsWith("/download")) return Response.json({ url: "https://r2.example.com/file" });
    return Response.json(payload, { status });
  });
  return calls;
}

afterEach(() => vi.restoreAllMocks());

describe("TicketBrandGuide", () => {
  it("shows colors, fonts, language and files", async () => {
    mockApi({
      brand: {
        ...EMPTY_BRAND,
        tagline: "Coffee that shows up",
        toneWords: ["friendly", "direct"],
        voiceDont: ["Hype"],
        colors: [{ id: "c1", hex: "#1f3a5f", name: "Harbor", role: "primary" }],
        fonts: [{ id: "f1", name: "Inter", url: "https://fonts.google.com/specimen/Inter" }],
      },
      assets: [FILE],
      logoLink: null,
    });
    render(<TicketBrandGuide ticketId="t1" />);

    expect(await screen.findByText("Coffee that shows up")).toBeInTheDocument();
    expect(screen.getByText("friendly, direct")).toBeInTheDocument();
    expect(screen.getByText("Hype")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy Harbor #1f3a5f" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Inter" })).toHaveAttribute(
      "href",
      "https://fonts.google.com/specimen/Inter",
    );
    expect(screen.getByText("logo.ai")).toBeInTheDocument();
    expect(screen.getByText(/Primary logo · For dark backgrounds · 4 KB/)).toBeInTheDocument();
    // One file: nothing to zip.
    expect(screen.queryByRole("button", { name: /Download all/ })).not.toBeInTheDocument();
  });

  it("asks this request's download route for a file", async () => {
    const calls = mockApi({ brand: EMPTY_BRAND, assets: [FILE], logoLink: null });
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    render(<TicketBrandGuide ticketId="t1" />);

    fireEvent.click(await screen.findByRole("button", { name: "Download logo.ai" }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://r2.example.com/file"));
    expect(calls).toContain("/api/tickets/t1/brand/assets/a1/download");
    vi.unstubAllGlobals();
  });

  it("offers one download for several files", async () => {
    mockApi({
      brand: EMPTY_BRAND,
      assets: [FILE, { ...FILE, id: "a2", name: "logo.svg" }],
      logoLink: null,
    });
    render(<TicketBrandGuide ticketId="t1" />);
    expect(await screen.findByRole("button", { name: "Download all (.zip)" })).toBeInTheDocument();
  });

  it("says so when the customer hasn't filled the guide in", async () => {
    mockApi({ brand: EMPTY_BRAND, assets: [], logoLink: null });
    render(<TicketBrandGuide ticketId="t1" />);
    expect(
      await screen.findByText("The customer hasn't filled in their brand guide yet."),
    ).toBeInTheDocument();
  });

  it("keeps the older logo link when a project has one", async () => {
    mockApi({ brand: EMPTY_BRAND, assets: [], logoLink: "https://cdn.example.com/logo.svg" });
    render(<TicketBrandGuide ticketId="t1" />);
    expect(
      await screen.findByRole("link", { name: "https://cdn.example.com/logo.svg" }),
    ).toBeInTheDocument();
  });

  it("stays out of the way when it can't load", async () => {
    mockApi({ error: "Request not found." }, 404);
    const { container } = render(<TicketBrandGuide ticketId="t1" />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("loads and downloads from whichever brand API it is given", async () => {
    const calls = mockApi({ brand: EMPTY_BRAND, assets: [FILE], logoLink: null });
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    render(<BrandGuidePanel apiBase="/api/admin/companies/c1/brand" />);

    fireEvent.click(await screen.findByRole("button", { name: "Download logo.ai" }));
    await waitFor(() => expect(assign).toHaveBeenCalled());
    expect(calls).toEqual([
      "/api/admin/companies/c1/brand",
      "/api/admin/companies/c1/brand/assets/a1/download",
    ]);
    vi.unstubAllGlobals();
  });
});
