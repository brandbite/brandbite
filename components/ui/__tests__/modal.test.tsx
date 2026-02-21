// -----------------------------------------------------------------------------
// @file: components/ui/__tests__/modal.test.tsx
// @purpose: Component tests for the Modal dialog
// -----------------------------------------------------------------------------

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Modal, ModalHeader, ModalFooter } from "@/components/ui/modal";

describe("Modal", () => {
  it("renders nothing when open=false", () => {
    const { container } = render(
      <Modal open={false} onClose={() => {}}>
        <p>Content</p>
      </Modal>,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders children when open=true", () => {
    render(
      <Modal open={true} onClose={() => {}}>
        <p>Hello Modal</p>
      </Modal>,
    );
    expect(screen.getByText("Hello Modal")).toBeInTheDocument();
  });

  it("calls onClose when Escape key is pressed", () => {
    const onClose = vi.fn();
    render(
      <Modal open={true} onClose={onClose}>
        <p>Content</p>
      </Modal>,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when backdrop is clicked", () => {
    const onClose = vi.fn();
    render(
      <Modal open={true} onClose={onClose}>
        <p>Content</p>
      </Modal>,
    );

    // Click on the outer overlay div (backdrop)
    const backdrop = screen.getByText("Content").parentElement!.parentElement!;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does NOT call onClose when modal content is clicked", () => {
    const onClose = vi.fn();
    render(
      <Modal open={true} onClose={onClose}>
        <p>Content</p>
      </Modal>,
    );

    fireEvent.click(screen.getByText("Content"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("applies size class", () => {
    render(
      <Modal open={true} onClose={() => {}} size="lg">
        <p>Sized</p>
      </Modal>,
    );
    const modalPanel = screen.getByText("Sized").parentElement!;
    expect(modalPanel.className).toContain("max-w-xl");
  });
});

describe("ModalHeader", () => {
  it("renders title", () => {
    render(<ModalHeader title="Test Title" />);
    expect(screen.getByText("Test Title")).toBeInTheDocument();
  });

  it("renders eyebrow when provided", () => {
    render(<ModalHeader eyebrow="STEP 1" title="Title" />);
    expect(screen.getByText("STEP 1")).toBeInTheDocument();
  });

  it("renders subtitle when provided", () => {
    render(<ModalHeader title="Title" subtitle="Sub info" />);
    expect(screen.getByText("Sub info")).toBeInTheDocument();
  });

  it("renders close button with aria-label when onClose provided", () => {
    const onClose = vi.fn();
    render(<ModalHeader title="Title" onClose={onClose} />);

    const closeBtn = screen.getByRole("button", { name: "Close" });
    expect(closeBtn).toBeInTheDocument();

    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not render close button when onClose is not provided", () => {
    render(<ModalHeader title="Title" />);
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
  });
});

describe("ModalFooter", () => {
  it("renders children", () => {
    render(
      <ModalFooter>
        <button>Save</button>
      </ModalFooter>,
    );
    expect(screen.getByText("Save")).toBeInTheDocument();
  });
});
