import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  BreadcrumbDetail,
  BreadcrumbDetailProvider,
  withDetailLabel,
} from "@/components/navigation/breadcrumb-detail";

describe("breadcrumb detail", () => {
  it("replaces only a trailing Detail step", () => {
    expect(withDetailLabel(["System", "Support", "Detail"], "Board and Tickets")).toEqual([
      "System",
      "Support",
      "Board and Tickets",
    ]);
    expect(withDetailLabel(["System", "Support"], "Board and Tickets")).toEqual([
      "System",
      "Support",
    ]);
    expect(withDetailLabel(["System", "Support", "Detail"], null)).toEqual([
      "System",
      "Support",
      "Detail",
    ]);
  });

  it("sets the label while the page is shown and clears it after", () => {
    const setLabel = vi.fn();
    const { unmount } = render(
      <BreadcrumbDetailProvider setLabel={setLabel}>
        <BreadcrumbDetail label="Board and Tickets" />
      </BreadcrumbDetailProvider>,
    );
    expect(setLabel).toHaveBeenLastCalledWith("Board and Tickets");
    unmount();
    expect(setLabel).toHaveBeenLastCalledWith(null);
  });

  it("does nothing outside a shell", () => {
    expect(() => render(<BreadcrumbDetail label="x" />)).not.toThrow();
  });
});
