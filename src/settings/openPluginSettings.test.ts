import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openPluginSettings } from "./openPluginSettings";

describe("openPluginSettings", () => {
  let requestAnimationFrameMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    requestAnimationFrameMock = vi.fn((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal("window", { requestAnimationFrame: requestAnimationFrameMock });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("runs pre-open cleanup before opening the plugin settings tab", () => {
    const beforeOpen = vi.fn();
    const open = vi.fn();
    const openTabById = vi.fn();

    openPluginSettings({ open, openTabById }, "plugins-activity", beforeOpen);

    expect(beforeOpen).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledOnce();
    expect(requestAnimationFrameMock).toHaveBeenCalledOnce();
    expect(openTabById).toHaveBeenCalledWith("plugins-activity");
    expect(beforeOpen.mock.invocationCallOrder[0]).toBeLessThan(open.mock.invocationCallOrder[0]);
    expect(open.mock.invocationCallOrder[0]).toBeLessThan(openTabById.mock.invocationCallOrder[0]);
  });

  it("opens settings even when no pre-open cleanup is provided", () => {
    const open = vi.fn();
    const openTabById = vi.fn();

    openPluginSettings({ open, openTabById }, "plugins-activity");

    expect(open).toHaveBeenCalledOnce();
    expect(openTabById).toHaveBeenCalledWith("plugins-activity");
  });
});
