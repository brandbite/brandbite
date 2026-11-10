import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CommentThreadClient, MoodboardItemClient } from "@/lib/moodboard";

import { CommentsPanel, itemLabel, timeAgo } from "../comments-panel";

const item = (id: string, body: string) =>
  ({
    id,
    type: "NOTE",
    data: { body },
    x: 0,
    y: 0,
    width: 200,
    height: 200,
  }) as unknown as MoodboardItemClient;

const thread = (over: Partial<CommentThreadClient> = {}): CommentThreadClient => ({
  id: "t1",
  itemId: "a",
  body: "Can we try it bolder?",
  author: { id: "u1", name: "Cara" },
  createdAt: new Date(Date.now() - 5 * 60000).toISOString(),
  edited: false,
  resolvedAt: null,
  replies: [
    {
      id: "r1",
      body: "Sure",
      author: { id: "u2", name: "Cem" },
      createdAt: new Date().toISOString(),
      edited: false,
    },
  ],
  ...over,
});

function setup(props: Partial<React.ComponentProps<typeof CommentsPanel>> = {}) {
  const handlers = {
    onClose: vi.fn(),
    onShowAll: vi.fn(),
    onFocusItem: vi.fn(),
    onStart: vi.fn(async () => true),
    onReply: vi.fn(async () => true),
    onResolve: vi.fn(),
    onDelete: vi.fn(),
  };
  render(
    <CommentsPanel
      threads={[
        thread(),
        thread({
          id: "t2",
          itemId: "b",
          body: "Done",
          resolvedAt: new Date().toISOString(),
          replies: [],
        }),
      ]}
      items={[item("a", "Wordmark"), item("b", "Colors")]}
      viewer={{ id: "u1", canModerate: false }}
      focusItemId={null}
      loading={false}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

describe("Comments panel", () => {
  it("lists open threads with their object and replies, and hides resolved ones until asked", () => {
    setup();
    expect(screen.getByRole("button", { name: "On Wordmark" })).toBeInTheDocument();
    expect(screen.getByText("Can we try it bolder?")).toBeInTheDocument();
    expect(screen.getByText("Sure")).toBeInTheDocument();
    expect(screen.queryByText("Done")).toBeNull();

    fireEvent.click(screen.getByRole("checkbox", { name: /Show resolved \(1\)/ }));
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reopen" })).toBeInTheDocument();
  });

  it("starts a thread on the chosen object", async () => {
    const { onStart } = setup({ focusItemId: "a" });
    expect(screen.getByText("Wordmark")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "New comment" }), {
      target: { value: "Try navy" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Comment" }));
    await waitFor(() => expect(onStart).toHaveBeenCalledWith("a", "Try navy"));
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "New comment" })).toHaveValue(""),
    );
  });

  it("replies, resolves, and only offers to delete your own comments", async () => {
    const { onReply, onResolve, onDelete } = setup();
    const row = screen.getByText("Can we try it bolder?").closest("li")!;
    expect(within(row).getAllByRole("button", { name: "Delete" })).toHaveLength(1);
    fireEvent.click(within(row).getByRole("button", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledWith("t1");

    fireEvent.click(within(row).getByRole("button", { name: "Resolve" }));
    expect(onResolve).toHaveBeenCalledWith("t1", true);

    fireEvent.click(within(row).getByRole("button", { name: "Reply" }));
    fireEvent.change(within(row).getByRole("textbox", { name: "Reply" }), {
      target: { value: "Thanks" },
    });
    fireEvent.click(within(row).getAllByRole("button", { name: "Reply" }).at(-1)!);
    await waitFor(() => expect(onReply).toHaveBeenCalledWith("t1", "Thanks"));
  });

  it("lets admins delete anyone's comment", () => {
    setup({ viewer: { id: "admin", canModerate: true } });
    const row = screen.getByText("Can we try it bolder?").closest("li")!;
    expect(within(row).getAllByRole("button", { name: "Delete" })).toHaveLength(2);
  });

  it("names objects and times briefly", () => {
    expect(itemLabel(item("x", "A very long sticky note text that goes on and on"))).toBe(
      "A very long sticky note text that goes …",
    );
    expect(itemLabel(undefined)).toBe("Deleted object");
    const now = Date.parse("2026-11-09T12:00:00Z");
    expect(timeAgo("2026-11-09T11:59:40Z", now)).toBe("just now");
    expect(timeAgo("2026-11-09T11:30:00Z", now)).toBe("30 min ago");
    expect(timeAgo("2026-11-09T07:00:00Z", now)).toBe("5 h ago");
  });
});
