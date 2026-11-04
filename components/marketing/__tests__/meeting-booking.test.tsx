import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { isTrackedPath } from "@/lib/analytics";

import { MeetingBooking, MeetingManage } from "../meeting-booking";

vi.mock("@marsidev/react-turnstile", () => ({ Turnstile: () => null }));

const SLOTS = ["2026-12-01T09:00:00.000Z", "2026-12-01T09:30:00.000Z", "2026-12-02T10:00:00.000Z"];

type Reply = { status?: number; json: unknown };

function mockFetch(routes: (url: string, init?: RequestInit) => Reply) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const reply = routes(String(input), init);
    return new Response(JSON.stringify(reply.json), { status: reply.status ?? 200 });
  });
}

const open = { json: { available: true, slots: SLOTS } };

async function fillAndChoose() {
  const time = (await screen.findAllByRole("button", { pressed: false })).find((b) =>
    /^\d\d:\d\d$/.test(b.textContent ?? ""),
  ) as HTMLElement;
  fireEvent.click(time);
  fireEvent.change(screen.getByLabelText(/Your name/), { target: { value: "Ada" } });
  fireEvent.change(screen.getByLabelText(/Email address/), { target: { value: "ada@test.local" } });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("MeetingBooking", () => {
  it("shows contact details instead of times when booking is unavailable", async () => {
    mockFetch(() => ({ json: { available: false, slots: [] } }));
    render(<MeetingBooking />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/unavailable right now/);
    expect(screen.getByRole("link", { name: "contact us" })).toHaveAttribute("href", "/contact");
    expect(screen.queryByLabelText("Your name")).toBeNull();
  });

  it("offers a way forward when no times are open", async () => {
    mockFetch(() => ({ json: { available: true, slots: [] } }));
    render(<MeetingBooking />);
    expect(await screen.findByText(/No times are open/)).toBeInTheDocument();
  });

  it("can't be submitted until a time is chosen", async () => {
    mockFetch(() => open);
    render(<MeetingBooking />);
    expect(await screen.findByRole("button", { name: /Book my 30-minute call/ })).toBeDisabled();
  });

  it("shows times in the chosen time zone, and sends that zone", async () => {
    const fetchMock = mockFetch((url, init) =>
      init?.method === "POST"
        ? { status: 201, json: { token: "tok", startsAt: SLOTS[0], videoLink: null } }
        : open,
    );
    render(<MeetingBooking />);
    const zone = await screen.findByLabelText("Time zone");
    fireEvent.change(zone, { target: { value: "Asia/Tokyo" } });
    expect(screen.getByRole("button", { name: "18:00" })).toBeInTheDocument();

    fireEvent.change(zone, { target: { value: "UTC" } });
    expect(screen.getByRole("button", { name: "09:00" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "09:00" }));
    fireEvent.change(screen.getByLabelText(/Your name/), { target: { value: "Ada" } });
    fireEvent.change(screen.getByLabelText(/Email address/), { target: { value: "a@test.local" } });
    expect(screen.getByText("Your intro call")).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Book my 30-minute call/ }));
    });
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(post?.[1]?.body as string).timezone).toBe("UTC");
  });

  it("moves between weeks that have open times", async () => {
    mockFetch(() => ({
      json: { available: true, slots: ["2026-12-01T09:00:00.000Z", "2026-12-09T09:00:00.000Z"] },
    }));
    render(<MeetingBooking />);
    fireEvent.change(await screen.findByLabelText("Time zone"), { target: { value: "UTC" } });
    expect(screen.getByRole("button", { name: "Previous week" })).toBeDisabled();
    expect(screen.getByText("Tuesday, 1 December")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next week" }));
    expect(screen.getByText("Wednesday, 9 December")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next week" })).toBeDisabled();
  });

  it("disables days with no open times", async () => {
    mockFetch(() => open);
    render(<MeetingBooking />);
    fireEvent.change(await screen.findByLabelText("Time zone"), { target: { value: "UTC" } });
    expect(screen.getByRole("button", { name: /Friday, 4 December/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Tuesday, 1 December/ })).toBeEnabled();
  });

  it("shows a few times first, with more on request", async () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      new Date(Date.UTC(2026, 11, 1, 9 + Math.floor(i / 2), (i % 2) * 30)).toISOString(),
    );
    mockFetch(() => ({ json: { available: true, slots: many } }));
    render(<MeetingBooking />);
    fireEvent.change(await screen.findByLabelText("Time zone"), { target: { value: "UTC" } });
    const times = () =>
      screen.getAllByRole("button").filter((b) => /^\d\d:\d\d$/.test(b.textContent ?? ""));
    expect(times()).toHaveLength(9);
    fireEvent.click(screen.getByRole("button", { name: "Show more times" }));
    expect(times()).toHaveLength(12);
  });

  it("links the privacy policy from the form", async () => {
    mockFetch(() => open);
    render(<MeetingBooking />);
    expect(await screen.findByRole("link", { name: "Privacy Policy" })).toHaveAttribute(
      "href",
      "/privacy#meetings",
    );
  });

  it("confirms a booking with the manage link", async () => {
    const fetchMock = mockFetch((url, init) =>
      init?.method === "POST"
        ? {
            status: 201,
            json: { token: "tok", startsAt: SLOTS[0], videoLink: "https://meet.google.com/abc" },
          }
        : open,
    );
    render(<MeetingBooking />);
    await fillAndChoose();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Book my 30-minute call/ }));
    });
    expect(screen.getByText("You're booked.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Reschedule or cancel" })).toHaveAttribute(
      "href",
      "/meetings/tok",
    );
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(post?.[1]?.body as string).startsAt).toBe(SLOTS[0]);
  });

  it("never submits in preview demo mode, and says so", async () => {
    const fetchMock = mockFetch(() => ({ json: { available: true, demo: true, slots: SLOTS } }));
    render(<MeetingBooking />);
    expect(await screen.findByText(/these are sample times/)).toBeInTheDocument();
    await fillAndChoose();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Book my 30-minute call/ }));
    });
    expect(screen.getByText(/nothing was booked and no emails were sent/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Reschedule or cancel" })).toBeNull();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });

  it("clears the choice and refreshes times if the slot was just taken", async () => {
    const fetchMock = mockFetch((url, init) =>
      init?.method === "POST"
        ? { status: 409, json: { error: "That time was just taken." } }
        : open,
    );
    render(<MeetingBooking />);
    await fillAndChoose();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Book my 30-minute call/ }));
    });
    expect(screen.getByRole("alert")).toHaveTextContent(/just taken/);
    expect(screen.getByRole("button", { name: /Book my 30-minute call/ })).toBeDisabled();
    const reads = fetchMock.mock.calls.filter(([url]) => String(url).includes("availability"));
    expect(reads.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByLabelText(/Your name/)).toHaveValue("Ada");
  });
});

describe("MeetingManage", () => {
  const future = new Date(Date.now() + 5 * 864e5).toISOString();
  const confirmed = { name: "Ada", startsAt: future, status: "CONFIRMED", videoLink: null };

  it("explains an invalid link", async () => {
    mockFetch(() => ({ status: 404, json: { error: "Meeting not found." } }));
    render(<MeetingManage token="nope" />);
    expect(await screen.findByText("Meeting not found")).toBeInTheDocument();
  });

  it("asks before canceling", async () => {
    const fetchMock = mockFetch((url, init) =>
      init?.method === "DELETE"
        ? { json: { meeting: { ...confirmed, status: "CANCELED" } } }
        : { json: { meeting: confirmed } },
    );
    render(<MeetingManage token="tok" />);
    fireEvent.click(await screen.findByRole("button", { name: "Cancel meeting" }));
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Yes, cancel it" }));
    });
    expect(screen.getByText("This meeting was canceled")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Book a new time" })).toBeInTheDocument();
  });

  it("keeps the meeting when the visitor changes their mind", async () => {
    mockFetch(() => ({ json: { meeting: confirmed } }));
    render(<MeetingManage token="tok" />);
    fireEvent.click(await screen.findByRole("button", { name: "Cancel meeting" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep it" }));
    expect(screen.getByRole("button", { name: "Reschedule" })).toBeInTheDocument();
  });

  it("shows an error and stays put when a change fails", async () => {
    mockFetch((url, init) =>
      init?.method === "DELETE"
        ? { status: 502, json: { error: "We couldn't reach the calendar." } }
        : { json: { meeting: confirmed } },
    );
    render(<MeetingManage token="tok" />);
    fireEvent.click(await screen.findByRole("button", { name: "Cancel meeting" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Yes, cancel it" }));
    });
    expect(screen.getByRole("alert")).toHaveTextContent(/couldn't reach/);
    expect(screen.queryByText("This meeting was canceled")).toBeNull();
  });

  it("reschedules to a chosen time", async () => {
    const fetchMock = mockFetch((url, init) => {
      if (url.includes("availability")) return open;
      if (init?.method === "PATCH") {
        return {
          json: { meeting: { ...confirmed, startsAt: JSON.parse(init.body as string).startsAt } },
        };
      }
      return { json: { meeting: confirmed } };
    });
    render(<MeetingManage token="tok" />);
    fireEvent.click(await screen.findByRole("button", { name: "Reschedule" }));
    expect(screen.getByRole("button", { name: "Move to this time" })).toBeDisabled();

    const time = (await screen.findAllByRole("button", { pressed: false })).find((b) =>
      /^\d\d:\d\d$/.test(b.textContent ?? ""),
    ) as HTMLElement;
    fireEvent.click(time);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Move to this time" }));
    });
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH");
    expect(JSON.parse(patch?.[1]?.body as string).startsAt).toBe(SLOTS[0]);
    expect(screen.getByRole("button", { name: "Reschedule" })).toBeInTheDocument();
  });
});

describe("analytics", () => {
  it("tracks the booking page but never a manage link, which holds a secret", () => {
    expect(isTrackedPath("/meet")).toBe(true);
    expect(isTrackedPath("/meetings/secret-token")).toBe(false);
  });
});
