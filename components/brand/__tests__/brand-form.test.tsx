import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BrandForm } from "@/components/brand/brand-form";
import { BrandQuestionnaires } from "@/components/brand/brand-questionnaires";
import {
  countAnswers,
  linesToList,
  QUESTIONS,
  readAnswers,
  submitQuestionnaireSchema,
} from "@/lib/brand/questionnaire";

type Call = { method: string; url: string; body: unknown };

function mockFetch(handler: (call: Call) => Response) {
  const calls: Call[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const call = {
      method: init?.method ?? "GET",
      url: String(input),
      body: typeof init?.body === "string" ? JSON.parse(init.body) : null,
    };
    calls.push(call);
    return handler(call);
  });
  return calls;
}

afterEach(() => vi.restoreAllMocks());

describe("brand form answers", () => {
  it("keeps only answered questions", () => {
    expect(
      readAnswers({
        description: "  We deliver coffee. ",
        tagline: "   ",
        values: ["reliable", "", 3],
        toneWords: [],
        colors: [{ hex: "#000000" }],
        name: "Someone else's brand",
      }),
    ).toEqual({ description: "We deliver coffee.", values: ["reliable"] });
    expect(readAnswers(null)).toEqual({});
    expect(countAnswers({ audience: "Offices", voiceDo: ["Be clear"] })).toBe(2);
  });

  it("needs a name and limits what can be sent", () => {
    const ok = submitQuestionnaireSchema.safeParse({
      respondentName: "Dana",
      answers: { values: [" warm ", "warm"], name: "Hijack", colors: [{ hex: "#fff" }] },
    });
    expect(ok.success).toBe(true);
    // Only the form's own questions get through: no brand name, no colors.
    expect(ok.success && ok.data.answers).toEqual({ values: ["warm"] });

    expect(submitQuestionnaireSchema.safeParse({ respondentName: " ", answers: {} }).success).toBe(
      false,
    );
    expect(
      submitQuestionnaireSchema.safeParse({
        respondentName: "Dana",
        answers: { description: "x".repeat(2001) },
      }).success,
    ).toBe(false);
  });

  it("splits list answers by line", () => {
    expect(linesToList(" warm \n\n direct ")).toEqual(["warm", "direct"]);
  });
});

describe("BrandForm", () => {
  it("asks for a name and at least one answer before sending", () => {
    const calls = mockFetch(() => Response.json({ success: true }));
    render(<BrandForm token="tok" companyName="Northwind" />);

    fireEvent.click(screen.getByRole("button", { name: "Send answers" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Please tell us your name.");

    fireEvent.change(screen.getByLabelText(/Your name/), { target: { value: "Dana" } });
    fireEvent.click(screen.getByRole("button", { name: "Send answers" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Please answer at least one question.");
    expect(calls).toHaveLength(0);
  });

  it("sends text as text and lists as lists, then thanks the person", async () => {
    const calls = mockFetch(() => Response.json({ success: true }));
    render(<BrandForm token="tok" companyName="Northwind" />);

    fireEvent.change(screen.getByLabelText(/Your name/), { target: { value: "Dana" } });
    fireEvent.change(screen.getByLabelText("Your role"), { target: { value: "Founder" } });
    fireEvent.change(screen.getByLabelText("What does the company do?"), {
      target: { value: "We deliver coffee." },
    });
    fireEvent.change(screen.getByLabelText("Things you would never say"), {
      target: { value: "Hype\nJargon" },
    });
    expect(screen.getByText(`2 of ${QUESTIONS.length} answered. This link can be sent once.`));
    fireEvent.click(screen.getByRole("button", { name: "Send answers" }));

    expect(await screen.findByRole("heading", { name: "Thank you" })).toBeInTheDocument();
    expect(calls).toEqual([
      {
        method: "POST",
        url: "/api/brand-form/tok",
        body: {
          respondentName: "Dana",
          respondentRole: "Founder",
          answers: { description: "We deliver coffee.", voiceDont: ["Hype", "Jargon"] },
        },
      },
    ]);
  });

  it("keeps the answers on screen when sending fails", async () => {
    mockFetch(() => Response.json({ error: "This link has already been used." }, { status: 410 }));
    render(<BrandForm token="tok" companyName="Northwind" />);
    fireEvent.change(screen.getByLabelText(/Your name/), { target: { value: "Dana" } });
    fireEvent.change(screen.getByLabelText("Do you have a tagline?"), {
      target: { value: "Coffee that shows up" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send answers" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("already been used");
    expect(screen.getByLabelText("Do you have a tagline?")).toHaveValue("Coffee that shows up");
  });
});

const OPEN_FORM = {
  id: "q1",
  status: "OPEN",
  recipientNote: "Dana, Marketing",
  respondentName: null,
  respondentRole: null,
  answers: {},
  url: "https://app.test/brand-form/abc",
  createdAt: "2026-11-15T10:00:00Z",
  submittedAt: null,
  expiresAt: "2026-12-15T10:00:00Z",
};
const ANSWERED_FORM = {
  ...OPEN_FORM,
  id: "q2",
  status: "SUBMITTED",
  respondentName: "Dana",
  respondentRole: "Founder",
  answers: { description: "We deliver coffee.", voiceDont: ["Hype", "Jargon"] },
  url: null,
  submittedAt: "2026-11-16T10:00:00Z",
};

describe("BrandQuestionnaires", () => {
  it("makes a link and shows it", async () => {
    const calls = mockFetch((call) =>
      call.method === "POST"
        ? Response.json({ form: OPEN_FORM }, { status: 201 })
        : Response.json({ forms: [] }),
    );
    render(<BrandQuestionnaires guideDirty={false} onApplied={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Who is it for? (optional)"), {
      target: { value: "Dana, Marketing" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create form link" }));

    expect(await screen.findByText("https://app.test/brand-form/abc")).toBeInTheDocument();
    expect(screen.getByText("Waiting for answers")).toBeInTheDocument();
    expect(calls.find((c) => c.method === "POST")!.body).toEqual({
      recipientNote: "Dana, Marketing",
    });
  });

  it("shows the answers and adds them only after confirming", async () => {
    const onApplied = vi.fn();
    const calls = mockFetch((call) =>
      call.method === "POST"
        ? Response.json({ brand: {} })
        : Response.json({ forms: [ANSWERED_FORM] }),
    );
    render(<BrandQuestionnaires guideDirty={false} onApplied={onApplied} />);

    fireEvent.click(await screen.findByRole("button", { name: "Read answers" }));
    expect(screen.getByText("We deliver coffee.")).toBeInTheDocument();
    expect(screen.getByText(/Hype\s+Jargon/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add to brand guide" }));
    expect(calls.some((c) => c.method === "POST")).toBe(false);
    const dialog = screen.getByText("Add these answers to the brand guide?").closest("div")!
      .parentElement!.parentElement!;
    fireEvent.click(within(dialog).getByRole("button", { name: "Add answers" }));

    await waitFor(() => expect(onApplied).toHaveBeenCalled());
    expect(calls.some((c) => c.method === "POST" && c.url.endsWith("/questionnaires/q2"))).toBe(
      true,
    );
    expect(await screen.findByText("Added to the guide")).toBeInTheDocument();
  });

  it("won't add answers over unsaved changes", async () => {
    mockFetch(() => Response.json({ forms: [ANSWERED_FORM] }));
    render(<BrandQuestionnaires guideDirty onApplied={vi.fn()} />);
    expect(await screen.findByRole("button", { name: "Add to brand guide" })).toBeDisabled();
    expect(screen.getByText(/Save or discard your changes/)).toBeInTheDocument();
  });

  it("closes a link", async () => {
    const calls = mockFetch((call) =>
      call.method === "DELETE"
        ? Response.json({ success: true })
        : Response.json({ forms: [OPEN_FORM] }),
    );
    render(<BrandQuestionnaires guideDirty={false} onApplied={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Close link" }));
    await waitFor(() =>
      expect(screen.queryByText("https://app.test/brand-form/abc")).not.toBeInTheDocument(),
    );
    expect(calls.some((c) => c.method === "DELETE" && c.url.endsWith("/q1"))).toBe(true);
  });
});
