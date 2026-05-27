import { afterEach, describe, expect, it, vi } from "vitest";
import { setActivityRecorder } from "./activityRecorder";
import { wrapEditorExtensionValue } from "./pluginApiHooks";

vi.mock("obsidian", () => {
  class Component {}
  class Plugin extends Component {}
  return { Component, Plugin };
});

describe("pluginApiHooks", () => {
  afterEach(() => {
    setActivityRecorder(null);
  });

  it("wraps runnable editor extensions without changing object identity", () => {
    const recorder = vi.fn();
    setActivityRecorder(recorder);
    const extension = {
      label: "kept",
      run: vi.fn(function (this: { label: string }, suffix: string) {
        return `${this.label}:${suffix}`;
      }),
    };

    const wrapped = wrapEditorExtensionValue("quickadd", extension);

    expect(wrapped).toBe(extension);
    expect(extension.run("choice")).toBe("kept:choice");
    expect(recorder).toHaveBeenCalledWith("quickadd", "interaction");
  });

  it("leaves immutable editor extension objects untouched", () => {
    const recorder = vi.fn();
    setActivityRecorder(recorder);
    const extension = Object.freeze({
      run: vi.fn(() => "unchanged"),
    });

    const wrapped = wrapEditorExtensionValue("quickadd", extension);

    expect(wrapped).toBe(extension);
    expect(extension.run()).toBe("unchanged");
    expect(recorder).not.toHaveBeenCalled();
  });

  it("does not mark read-only runnable specs as wrapped", () => {
    const recorder = vi.fn();
    setActivityRecorder(recorder);
    const extension = {};
    Object.defineProperty(extension, "run", {
      configurable: false,
      value: vi.fn(() => "read-only"),
      writable: false,
    });

    const wrapped = wrapEditorExtensionValue("quickadd", extension) as {
      __pluginsActivityWrapped?: boolean;
      run: () => string;
    };

    expect(wrapped).toBe(extension);
    expect(wrapped.run()).toBe("read-only");
    expect(wrapped.__pluginsActivityWrapped).toBeUndefined();
    expect(recorder).not.toHaveBeenCalled();
  });
});
