import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  CloseButton,
  ExpandLink,
  FullPageViewControls,
  fullPageViewLinks,
} from "@/components/dashboard/tickets/view-switch";

describe("request view switch", () => {
  it("collapses to the board window and closes back to where you came from", () => {
    expect(fullPageViewLinks("customer", "t 1", true)).toEqual({
      windowHref: "/customer/board?open=t%201",
      closeHref: "/customer/board",
    });
    expect(fullPageViewLinks("creative", "t1", false)).toEqual({
      windowHref: "/creative/board?open=t1",
      closeHref: "/creative/tickets",
    });
  });

  it("renders labelled icon links on the full page", () => {
    render(
      <FullPageViewControls windowHref="/customer/board?open=t1" closeHref="/customer/tickets" />,
    );
    expect(screen.getByRole("link", { name: "Show as window" })).toHaveAttribute(
      "href",
      "/customer/board?open=t1",
    );
    expect(screen.getByRole("link", { name: "Close" })).toHaveAttribute(
      "href",
      "/customer/tickets",
    );
  });

  it("leaves out Collapse where there is no window (admin)", () => {
    render(<FullPageViewControls closeHref="/admin/board" />);
    expect(screen.queryByRole("link", { name: "Show as window" })).toBeNull();
    expect(screen.getByRole("link", { name: "Close" })).toHaveAttribute("href", "/admin/board");
  });

  it("expands and closes from the window", () => {
    const onClose = vi.fn();
    render(
      <>
        <ExpandLink href="/creative/tickets/t1?from=board" />
        <CloseButton onClick={onClose} label="Close details" />
      </>,
    );
    expect(screen.getByRole("link", { name: "Open full page" })).toHaveAttribute(
      "href",
      "/creative/tickets/t1?from=board",
    );
    fireEvent.click(screen.getByRole("button", { name: "Close details" }));
    expect(onClose).toHaveBeenCalled();
  });
});
