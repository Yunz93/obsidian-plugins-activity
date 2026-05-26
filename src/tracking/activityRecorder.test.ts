import { afterEach, describe, expect, it, vi } from "vitest";
import { recordPluginActivity, setActivityRecorder } from "./activityRecorder";

describe("activityRecorder", () => {
  afterEach(() => {
    setActivityRecorder(null);
    vi.useRealTimers();
  });

  it("deduplicates the same plugin and activity kind inside the short window", () => {
    vi.useFakeTimers();
    const recorder = vi.fn();
    setActivityRecorder(recorder);

    recordPluginActivity("quickadd", "command");
    vi.advanceTimersByTime(50);
    recordPluginActivity("quickadd", "command");
    vi.advanceTimersByTime(50);
    recordPluginActivity("quickadd", "command");

    expect(recorder).toHaveBeenCalledTimes(2);
  });

  it("does not deduplicate different activity kinds for the same plugin", () => {
    vi.useFakeTimers();
    const recorder = vi.fn();
    setActivityRecorder(recorder);

    recordPluginActivity("quickadd", "command");
    recordPluginActivity("quickadd", "interaction");
    recordPluginActivity("quickadd", "render");

    expect(recorder).toHaveBeenCalledTimes(3);
    expect(recorder).toHaveBeenNthCalledWith(1, "quickadd", "command");
    expect(recorder).toHaveBeenNthCalledWith(2, "quickadd", "interaction");
    expect(recorder).toHaveBeenNthCalledWith(3, "quickadd", "render");
  });
});
