import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OnboardingBrandStep, splitToneWords } from "@/components/brand/onboarding-brand-step";

type Call = { method: string; url: string; body: unknown };

function mockApi(patchStatus = 200) {
  const calls: Call[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    calls.push({
      method,
      url,
      body: typeof init?.body === "string" ? JSON.parse(init.body) : null,
    });
    if (url === "/api/customer/brand") {
      return Response.json(patchStatus === 200 ? { brand: {} } : { error: "Nope." }, {
        status: patchStatus,
      });
    }
    if (url === "/api/customer/brand/assets") {
      return Response.json({
        assetId: "a1",
        uploadUrl: "https://r2.example.com/put",
        contentType: "image/svg+xml",
      });
    }
    if (url === "https://r2.example.com/put") return new Response(null, { status: 200 });
    return Response.json({ asset: { id: "a1" } });
  });
  return calls;
}

const renderStep = (onDone = vi.fn()) => {
  render(<OnboardingBrandStep onDone={onDone} renderActions={(actions) => <div>{actions}</div>} />);
  return onDone;
};

afterEach(() => vi.restoreAllMocks());

describe("OnboardingBrandStep", () => {
  it("can be skipped without saving anything", () => {
    const calls = mockApi();
    const onDone = renderStep();
    expect(screen.getByRole("button", { name: "Save and continue" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(onDone).toHaveBeenCalledWith(false);
    expect(calls).toHaveLength(0);
  });

  it("saves the text into the brand guide and moves on", async () => {
    const calls = mockApi();
    const onDone = renderStep();
    fireEvent.change(screen.getByLabelText("What does your company do?"), {
      target: { value: "We deliver coffee." },
    });
    fireEvent.change(screen.getByLabelText("Three words for how your brand sounds"), {
      target: { value: "warm, direct; warm" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));

    await waitFor(() => expect(onDone).toHaveBeenCalledWith(true));
    expect(calls).toEqual([
      {
        method: "PATCH",
        url: "/api/customer/brand",
        body: { description: "We deliver coffee.", audience: "", toneWords: ["warm", "direct"] },
      },
    ]);
  });

  it("uploads a logo as the primary logo", async () => {
    const calls = mockApi();
    const onDone = renderStep();
    fireEvent.change(screen.getByLabelText("Your logo"), {
      target: { files: [new File(["<svg/>"], "logo.svg", { type: "image/svg+xml" })] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));

    await waitFor(() => expect(onDone).toHaveBeenCalledWith(true));
    expect(calls[0]).toMatchObject({
      url: "/api/customer/brand/assets",
      body: { name: "logo.svg", kind: "LOGO_PRIMARY" },
    });
    expect(calls.some((c) => c.url === "/api/customer/brand")).toBe(false);
  });

  it("refuses a logo of the wrong type", () => {
    mockApi();
    renderStep();
    fireEvent.change(screen.getByLabelText("Your logo"), {
      target: { files: [new File(["x"], "logo.exe")] },
    });
    expect(screen.getByRole("alert")).toHaveTextContent(/isn't supported/);
    expect(screen.getByRole("button", { name: "Save and continue" })).toBeDisabled();
  });

  it("stays on the step and says why when saving fails", async () => {
    mockApi(403);
    const onDone = renderStep();
    fireEvent.change(screen.getByLabelText("Who is it for?"), { target: { value: "Offices" } });
    fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Nope.");
    expect(onDone).not.toHaveBeenCalled();
  });
});

describe("splitToneWords", () => {
  it("splits on commas, semicolons and new lines, without repeats", () => {
    expect(splitToneWords(" warm , direct;playful\nwarm ")).toEqual(["warm", "direct", "playful"]);
    expect(splitToneWords("")).toEqual([]);
  });
});
