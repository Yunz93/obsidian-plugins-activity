import { describe, expect, it } from "vitest";
import { getReleaseNotes, RELEASE_NOTES } from "./releaseNotes";

describe("releaseNotes", () => {
  it("includes 0.1.7 with non-empty en and zh highlights", () => {
    const entry = RELEASE_NOTES.find((note) => note.version === "0.1.7");
    expect(entry).toBeDefined();
    expect(entry?.en.length).toBeGreaterThan(0);
    expect(entry?.zh.length).toBeGreaterThan(0);
  });

  it("returns localized highlights for a known version", () => {
    expect(getReleaseNotes("0.1.7", "en").length).toBeGreaterThan(0);
    expect(getReleaseNotes("0.1.7", "zh").length).toBeGreaterThan(0);
  });

  it("returns an empty list for unknown versions", () => {
    expect(getReleaseNotes("9.9.9", "en")).toEqual([]);
  });
});
