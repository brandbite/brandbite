import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useLiveRefresh } from "../use-live-refresh";

let visibility: DocumentVisibilityState = "visible";

beforeEach(() => {
  vi.useFakeTimers();
  visibility = "visible";
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const flush = () => act(async () => {});

describe("useLiveRefresh", () => {
  it("refreshes every interval while the tab is visible", async () => {
    const refresh = vi.fn();
    renderHook(() => useLiveRefresh(refresh, { intervalMs: 30_000 }));
    expect(refresh).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(30_000));
    await act(async () => vi.advanceTimersByTime(30_000));
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("makes no requests while the tab is hidden", async () => {
    const refresh = vi.fn();
    renderHook(() => useLiveRefresh(refresh, { intervalMs: 30_000 }));
    visibility = "hidden";
    await act(async () => vi.advanceTimersByTime(90_000));
    expect(refresh).not.toHaveBeenCalled();
  });

  it("refreshes when the person comes back to the tab, but not twice in a row", async () => {
    const refresh = vi.fn();
    renderHook(() => useLiveRefresh(refresh));
    await act(async () => vi.advanceTimersByTime(10_000));
    visibility = "visible";
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("focus"));
    });
    await flush();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("waits while paused, so nothing changes under someone mid-drag", async () => {
    const refresh = vi.fn();
    const { rerender } = renderHook(({ paused }) => useLiveRefresh(refresh, { paused }), {
      initialProps: { paused: true },
    });
    await act(async () => vi.advanceTimersByTime(30_000));
    expect(refresh).not.toHaveBeenCalled();
    rerender({ paused: false });
    await act(async () => vi.advanceTimersByTime(30_000));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("keeps going after a failed refresh", async () => {
    const refresh = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(undefined);
    renderHook(() => useLiveRefresh(refresh, { intervalMs: 30_000 }));
    await act(async () => vi.advanceTimersByTime(30_000));
    await act(async () => vi.advanceTimersByTime(30_000));
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
