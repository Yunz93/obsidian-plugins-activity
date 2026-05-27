import { describe, expect, it } from "vitest";
import { getUpdateButtonState } from "./updateButton";
import type { PluginUpdateStatus } from "./updateTypes";

function status(kind: PluginUpdateStatus["kind"]): PluginUpdateStatus {
  return { kind, checkedAt: null };
}

describe("getUpdateButtonState", () => {
  it("enables only available updates", () => {
    expect(getUpdateButtonState(status("available"))).toMatchObject({
      disabled: false,
      labelKey: "update",
    });
    expect(getUpdateButtonState(status("current"))).toMatchObject({
      disabled: true,
      labelKey: "upToDate",
    });
    expect(getUpdateButtonState(status("checking"))).toMatchObject({
      disabled: true,
      labelKey: "checkingUpdates",
    });
    expect(getUpdateButtonState(status("unknown"))).toMatchObject({
      disabled: true,
      labelKey: "updateUnknown",
    });
  });
});
