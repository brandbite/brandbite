import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BrandGuidePanel,
  BrandGuideSummary,
  TicketBrandGuide,
} from "@/components/brand/ticket-brand-guide";

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

const openTab = (name: string) => fireEvent.click(screen.getByRole("tab", { name }));

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
    });
    render(<TicketBrandGuide ticketId="t1" />);

    expect(await screen.findByText("Coffee that shows up")).toBeInTheDocument();
    expect(screen.getByText("Read only")).toBeInTheDocument();

    openTab("Brand language");
    expect(screen.getByText("friendly")).toBeInTheDocument();
    expect(screen.getByText("direct")).toBeInTheDocument();
    expect(screen.getByText("Hype")).toBeInTheDocument();

    openTab("Visual identity");
    expect(screen.getByRole("button", { name: "Copy Harbor #1f3a5f" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Inter" })).toHaveAttribute(
      "href",
      "https://fonts.google.com/specimen/Inter",
    );

    openTab("Brand files");
    expect(screen.getByText("logo.ai")).toBeInTheDocument();
    expect(screen.getByText(/Primary logo · For dark backgrounds · 4 KB/)).toBeInTheDocument();
    // One file: nothing to zip.
    expect(screen.queryByRole("button", { name: /Download all/ })).not.toBeInTheDocument();
  });

  it("asks this request's download route for a file", async () => {
    const calls = mockApi({ brand: EMPTY_BRAND, assets: [FILE] });
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    render(<TicketBrandGuide ticketId="t1" />);

    openTab(await screen.findByText("Brand files").then(() => "Brand files"));
    fireEvent.click(screen.getByRole("button", { name: "Download logo.ai" }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://r2.example.com/file"));
    expect(calls).toContain("/api/tickets/t1/brand/assets/a1/download");
    vi.unstubAllGlobals();
  });

  it("offers one download for several files", async () => {
    mockApi({
      brand: EMPTY_BRAND,
      assets: [FILE, { ...FILE, id: "a2", name: "logo.svg" }],
    });
    render(<TicketBrandGuide ticketId="t1" />);
    openTab(await screen.findByText("Brand files").then(() => "Brand files"));
    expect(screen.getByRole("button", { name: "Download all (.zip)" })).toBeInTheDocument();
  });

  it("says so when the customer hasn't filled the guide in", async () => {
    mockApi({ brand: EMPTY_BRAND, assets: [] });
    render(<TicketBrandGuide ticketId="t1" />);
    expect(
      await screen.findByText("The customer hasn't filled in their brand guide yet."),
    ).toBeInTheDocument();
  });

  it("stays out of the way when it can't load", async () => {
    mockApi({ error: "Request not found." }, 404);
    const { container } = render(<TicketBrandGuide ticketId="t1" />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("loads and downloads from whichever brand API it is given", async () => {
    const calls = mockApi({ brand: EMPTY_BRAND, assets: [FILE] });
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    render(<BrandGuidePanel apiBase="/api/admin/companies/c1/brand" layout="page" />);

    expect(await screen.findByText("Only the customer can edit this guide.")).toBeInTheDocument();
    openTab("Brand files");
    fireEvent.click(screen.getByRole("button", { name: "Download logo.ai" }));
    await waitFor(() => expect(assign).toHaveBeenCalled());
    expect(calls).toEqual([
      "/api/admin/companies/c1/brand",
      "/api/admin/companies/c1/brand/assets/a1/download",
    ]);
    vi.unstubAllGlobals();
  });

  it("says whose guide it is when the API names the company", async () => {
    mockApi({ brand: EMPTY_BRAND, assets: [FILE], companyName: "Acme Studio" });
    const onCompanyName = vi.fn();
    render(
      <BrandGuidePanel
        apiBase="/api/admin/companies/c1/brand"
        layout="page"
        onCompanyName={onCompanyName}
      />,
    );
    await waitFor(() => expect(onCompanyName).toHaveBeenCalledWith("Acme Studio"));
  });

  it("names a file by its short name when it has one", async () => {
    mockApi({ brand: EMPTY_BRAND, assets: [{ ...FILE, label: "Ink logo" }] });
    render(<TicketBrandGuide ticketId="t1" />);
    openTab(await screen.findByText("Brand files").then(() => "Brand files"));
    expect(screen.getByText("Ink logo")).toBeInTheDocument();
    expect(screen.getByText("logo.ai")).toBeInTheDocument();
  });
});

describe("BrandGuideSummary", () => {
  const FULL = "/creative/tickets/t1?from=board&tab=brief&focus=brand";

  it("shows colors, fonts, tone and the files in the board window", async () => {
    mockApi({
      brand: {
        ...EMPTY_BRAND,
        toneWords: ["friendly", "direct"],
        colors: [{ id: "c1", hex: "#1f3a5f", name: "Harbor", role: "primary" }],
        fonts: [
          { id: "f1", name: "Inter" },
          { id: "f2", name: "Fraunces" },
        ],
      },
      assets: [FILE, { ...FILE, id: "a2", name: "logo.svg" }],
    });
    render(<BrandGuideSummary ticketId="t1" fullHref={FULL} />);

    expect(await screen.findByText("Northwind")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy Harbor #1f3a5f" })).toBeInTheDocument();
    expect(screen.getByText("Inter · Fraunces")).toBeInTheDocument();
    expect(screen.getByText("friendly · direct")).toBeInTheDocument();
    expect(screen.getByText("2 brand files")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download all (.zip)" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open full brand guide" })).toHaveAttribute(
      "href",
      FULL,
    );
  });

  it("says so when the guide is empty, and hides when it can't load", async () => {
    mockApi({ brand: EMPTY_BRAND, assets: [] });
    const first = render(<BrandGuideSummary ticketId="t1" fullHref={FULL} />);
    expect(
      await screen.findByText("The customer hasn't filled in their brand guide yet."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open full brand guide" })).not.toBeInTheDocument();
    first.unmount();
    vi.restoreAllMocks();

    mockApi({ error: "Request not found." }, 404);
    const { container } = render(<BrandGuideSummary ticketId="t1" fullHref={FULL} />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
