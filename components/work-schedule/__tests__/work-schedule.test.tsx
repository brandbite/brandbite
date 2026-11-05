import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  WorkScheduleEditor,
  workScheduleProblem,
} from "@/components/work-schedule/work-schedule-editor";
import { WorkScheduleSummary } from "@/components/work-schedule/work-schedule-summary";
import { defaultWorkSchedule, type WorkSchedule } from "@/lib/work-schedule";

function Harness({ onChange }: { onChange: (next: WorkSchedule) => void }) {
  const [value, setValue] = useState(defaultWorkSchedule("Europe/Istanbul"));
  return (
    <WorkScheduleEditor
      idPrefix="t"
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

function setup() {
  const onChange = vi.fn();
  render(<Harness onChange={onChange} />);
  const latest = () => onChange.mock.calls.at(-1)![0] as WorkSchedule;
  return { latest };
}

afterEach(() => vi.useRealTimers());

describe("WorkScheduleEditor", () => {
  it("gives each day its own start and end", () => {
    const { latest } = setup();
    fireEvent.change(screen.getByLabelText("Monday start time"), { target: { value: "08:00" } });
    fireEvent.change(screen.getByLabelText("Wednesday end time"), { target: { value: "14:30" } });
    expect(latest().days.mon).toEqual({ start: "08:00", end: "18:00" });
    expect(latest().days.wed).toEqual({ start: "09:00", end: "14:30" });
    expect(latest().days.tue).toEqual({ start: "09:00", end: "18:00" });
  });

  it("turns days on and off", () => {
    const { latest } = setup();
    expect(screen.queryByLabelText("Saturday start time")).toBeNull();
    fireEvent.click(screen.getByRole("checkbox", { name: "Saturday" }));
    expect(screen.getByLabelText("Saturday start time")).toBeInTheDocument();
    expect(latest().days.sat).toEqual({ start: "09:00", end: "18:00" });

    fireEvent.click(screen.getByRole("checkbox", { name: "Friday" }));
    expect(latest().days.fri).toBeNull();
    expect(screen.queryByLabelText("Friday start time")).toBeNull();
  });

  it("offers no free-text field", () => {
    setup();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("changes the time zone", () => {
    const { latest } = setup();
    fireEvent.change(screen.getByLabelText("Time zone"), { target: { value: "Asia/Dubai" } });
    expect(latest().timezone).toBe("Asia/Dubai");
  });

  it("copies the first working day's hours to working days only", () => {
    const { latest } = setup();
    fireEvent.change(screen.getByLabelText("Monday start time"), { target: { value: "10:00" } });
    fireEvent.click(screen.getByRole("button", { name: /Use 10:00–18:00 on all working days/ }));
    expect(latest().days.fri).toEqual({ start: "10:00", end: "18:00" });
    expect(latest().days.sat).toBeNull();
  });

  it("resets to weekdays, keeping the chosen zone", () => {
    const { latest } = setup();
    fireEvent.change(screen.getByLabelText("Time zone"), { target: { value: "Asia/Dubai" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Monday" }));
    fireEvent.click(screen.getByRole("button", { name: "Weekdays 09:00–18:00" }));
    expect(latest()).toEqual(defaultWorkSchedule("Asia/Dubai"));
  });

  it("explains a backwards range", () => {
    setup();
    fireEvent.change(screen.getByLabelText("Tuesday end time"), { target: { value: "08:00" } });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Tuesday: the end time needs to be after the start time.",
    );
  });
});

describe("workScheduleProblem", () => {
  it("wants at least one working day", () => {
    const empty: WorkSchedule = {
      timezone: "UTC",
      days: { mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null },
    };
    expect(workScheduleProblem(empty)).toBe("Pick at least one working day.");
    expect(workScheduleProblem(defaultWorkSchedule("UTC"))).toBeNull();
  });
});

describe("WorkScheduleSummary", () => {
  it("shows the old note until a schedule exists", () => {
    const { unmount } = render(<WorkScheduleSummary schedule={null} legacyNote="9-18 weekdays" />);
    expect(screen.getByText("Not set")).toBeInTheDocument();
    expect(screen.getByText("Old note: 9-18 weekdays")).toBeInTheDocument();
    unmount();

    render(
      <WorkScheduleSummary schedule={defaultWorkSchedule("UTC")} legacyNote="9-18 weekdays" />,
    );
    expect(screen.queryByText(/Old note/)).toBeNull();
    expect(screen.getByText("Mon–Fri 09:00–18:00")).toBeInTheDocument();
  });

  it("says whether they're working now", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-04T12:00:00Z"));
    const { unmount } = render(<WorkScheduleSummary schedule={defaultWorkSchedule("UTC")} />);
    expect(screen.getByText("Working now")).toBeInTheDocument();
    unmount();

    vi.setSystemTime(new Date("2026-11-07T12:00:00Z"));
    render(<WorkScheduleSummary schedule={defaultWorkSchedule("UTC")} />);
    expect(screen.getByText("Outside working hours")).toBeInTheDocument();
  });

  it("adds the viewer's clock only when it differs", () => {
    const local = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const { unmount } = render(<WorkScheduleSummary schedule={defaultWorkSchedule(local)} />);
    expect(screen.queryByText(/Your time/)).toBeNull();
    unmount();

    const elsewhere = local === "Asia/Tokyo" ? "America/New_York" : "Asia/Tokyo";
    render(<WorkScheduleSummary schedule={defaultWorkSchedule(elsewhere)} />);
    expect(screen.getByText(/^Your time: /)).toBeInTheDocument();
  });
});
