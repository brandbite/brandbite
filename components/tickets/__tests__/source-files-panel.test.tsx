import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SourceFilesPanel, formatBytes } from "@/components/tickets/source-files-panel";

type FileRow = {
  id: string;
  name: string;
  sizeBytes: number;
  storage: "GOOGLE_DRIVE" | "R2";
  externalUrl: string | null;
  deleteAfter: string | null;
  uploadedBy: string | null;
  createdAt: string;
  canRemove: boolean;
};

const fileRow = (overrides: Partial<FileRow> = {}): FileRow => ({
  id: "f1",
  name: "poster.psd",
  sizeBytes: 3 * 1024 * 1024 * 1024,
  storage: "R2",
  externalUrl: null,
  deleteAfter: null,
  uploadedBy: "Ada Creative",
  createdAt: "2026-11-10T09:00:00Z",
  canRemove: false,
  ...overrides,
});

let puts: { url: string; contentType: string | null }[];

class FakeXhr {
  status = 200;
  responseText = "";
  upload: {
    onprogress: ((e: { lengthComputable: boolean; loaded: number; total: number }) => void) | null;
  } = {
    onprogress: null,
  };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private url = "";
  private headers: Record<string, string> = {};
  open(_method: string, url: string) {
    this.url = url;
  }
  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }
  send() {
    puts.push({ url: this.url, contentType: this.headers["Content-Type"] ?? null });
    this.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 });
    this.responseText = JSON.stringify({ id: "drive-file-1" });
    setTimeout(() => this.onload?.(), 0);
  }
}

function mockApi(listing: {
  files: FileRow[];
  canUpload: boolean;
  destination: "GOOGLE_DRIVE" | "R2";
}) {
  const calls: { method: string; url: string; body: unknown }[] = [];
  let files = listing.files;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const method = init?.method ?? "GET";
    const url = String(input);
    calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : null });
    if (method === "POST" && url.endsWith("/source-files")) {
      return Response.json({
        fileId: "new",
        storage: listing.destination,
        uploadUrl: "https://upload.test/session",
        contentType: "image/vnd.adobe.photoshop",
      });
    }
    if (method === "POST" && url.endsWith("/complete")) {
      files = [fileRow({ id: "new", name: "new.psd", storage: listing.destination }), ...files];
      return Response.json({ file: {} });
    }
    if (method === "DELETE") {
      files = files.filter((f) => !url.endsWith(f.id));
      return Response.json({ ok: true });
    }
    return Response.json({ ...listing, files, retentionDays: 90 });
  });
  return calls;
}

beforeEach(() => {
  puts = [];
  vi.stubGlobal("XMLHttpRequest", FakeXhr);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("SourceFilesPanel", () => {
  it("formats sizes for people", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(3 * 1024 * 1024 * 1024)).toBe("3.0 GB");
  });

  it("uploads straight to the customer's Drive, then confirms with the Drive file id", async () => {
    const calls = mockApi({ files: [], canUpload: true, destination: "GOOGLE_DRIVE" });
    render(<SourceFilesPanel ticketId="t1" viewer="creative" />);

    expect(
      await screen.findByText(/straight into the customer's Google Drive/),
    ).toBeInTheDocument();
    const input = screen.getByLabelText("Choose source files");
    const file = new File(["x".repeat(10)], "new.psd", { type: "image/vnd.adobe.photoshop" });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(calls.some((c) => c.url.endsWith("/new/complete"))).toBe(true));
    expect(await screen.findByText("new.psd")).toBeInTheDocument();
    expect(calls.find((c) => c.method === "POST" && c.url.endsWith("/source-files"))?.body).toEqual(
      {
        name: "new.psd",
        sizeBytes: 10,
        mimeType: "image/vnd.adobe.photoshop",
      },
    );
    expect(puts).toEqual([
      { url: "https://upload.test/session", contentType: "image/vnd.adobe.photoshop" },
    ]);
    expect(calls.find((c) => c.url.endsWith("/new/complete"))?.body).toEqual({
      externalId: "drive-file-1",
    });
  });

  it("tells the creative when files go to brandbite storage instead", async () => {
    mockApi({ files: [], canUpload: true, destination: "R2" });
    render(<SourceFilesPanel ticketId="t1" viewer="creative" />);
    expect(
      await screen.findByText(/kept for 90 days after the request is done/),
    ).toBeInTheDocument();
  });

  it("shows customers how long brandbite keeps files and how to keep them for good", async () => {
    mockApi({
      files: [fileRow({ deleteAfter: "2027-01-30T10:00:00Z" })],
      canUpload: false,
      destination: "R2",
    });
    render(<SourceFilesPanel ticketId="t1" viewer="customer" />);

    expect(await screen.findByText(/On brandbite until/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Download" })).toHaveAttribute(
      "href",
      "/api/tickets/t1/source-files/f1/download",
    );
    expect(screen.getByRole("link", { name: "Connect Google Drive" })).toHaveAttribute(
      "href",
      "/customer/settings?tab=integrations",
    );
    expect(screen.queryByRole("button", { name: "Upload source files" })).toBeNull();
  });

  it("opens Drive files in Drive for customers, and shows no Drive link to others", async () => {
    mockApi({
      files: [fileRow({ storage: "GOOGLE_DRIVE", externalUrl: "https://drive.test/f1" })],
      canUpload: false,
      destination: "GOOGLE_DRIVE",
    });
    const { unmount } = render(<SourceFilesPanel ticketId="t1" viewer="customer" />);
    expect(await screen.findByRole("link", { name: "Open in Drive" })).toBeInTheDocument();
    expect(screen.queryByText("Keep your source files for good")).toBeNull();
    unmount();

    render(<SourceFilesPanel ticketId="t1" viewer="creative" />);
    expect(await screen.findByText("In Google Drive")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open in Drive" })).toBeNull();
  });

  it("removes a file when the server allows it", async () => {
    const calls = mockApi({
      files: [fileRow({ canRemove: true }), fileRow({ id: "f2", name: "other.ai" })],
      canUpload: true,
      destination: "R2",
    });
    render(<SourceFilesPanel ticketId="t1" viewer="creative" />);
    const item = (await screen.findByText("poster.psd")).closest("li")!;
    expect(
      within(screen.getByText("other.ai").closest("li")!).queryByRole("button", { name: "Remove" }),
    ).toBeNull();

    fireEvent.click(within(item).getByRole("button", { name: "Remove" }));
    await waitFor(() =>
      expect(calls).toContainEqual({
        method: "DELETE",
        url: "/api/tickets/t1/source-files/f1",
        body: null,
      }),
    );
    await waitFor(() => expect(screen.queryByText("poster.psd")).toBeNull());
  });
});
