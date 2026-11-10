import { afterEach, describe, expect, it, vi } from "vitest";

import { findDriveFileInFolder } from "../google-drive";

afterEach(() => vi.unstubAllGlobals());

describe("findDriveFileInFolder", () => {
  it("escapes quotes and backslashes in the Drive query", async () => {
    let query = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        query = new URL(String(input)).searchParams.get("q") ?? "";
        return Response.json({ files: [] });
      }),
    );
    await findDriveFileInFolder("token", "folder-1", "it's a\\b.psd");
    expect(query).toBe("'folder-1' in parents and name = 'it\\'s a\\\\b.psd' and trashed = false");
  });

  it("returns the newest match with its size and link", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          files: [{ id: "f1", name: "a.psd", size: "42", webViewLink: "https://drive.test/f1" }],
        }),
      ),
    );
    expect(await findDriveFileInFolder("token", "folder-1", "a.psd")).toMatchObject({
      id: "f1",
      size: 42,
      webViewLink: "https://drive.test/f1",
    });
  });
});
