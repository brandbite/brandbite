import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SourceFilesRetentionNote } from "@/components/tickets/source-files-retention-note";

function mockFiles(storages: string[]) {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({ files: storages.map((storage, i) => ({ id: `f${i}`, storage })) }),
  );
}

afterEach(() => vi.restoreAllMocks());

describe("SourceFilesRetentionNote", () => {
  it("warns that files on brandbite are deleted 90 days after approval", async () => {
    mockFiles(["R2", "R2", "GOOGLE_DRIVE"]);
    render(<SourceFilesRetentionNote ticketId="t1" />);
    expect(await screen.findByText("Download your source files")).toBeInTheDocument();
    expect(screen.getByText(/2 source files are kept on brandbite until/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "connect Google Drive" })).toHaveAttribute(
      "href",
      "/customer/settings?tab=integrations",
    );
  });

  it("stays out of the way when every file is in the customer's Drive", async () => {
    mockFiles(["GOOGLE_DRIVE"]);
    const { container } = render(<SourceFilesRetentionNote ticketId="t1" />);
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
