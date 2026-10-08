import { describe, expect, it } from "vitest";
import { mentionedPeople, resolveWatchedPeople } from "../src/people";

describe("market people", () => {
  it("matches aliases and ignores unrelated text", () => {
    const people = resolveWatchedPeople(["Vitalik Buterin", "Elon Musk"]);
    expect(mentionedPeople("Vitalik sketches a new Ethereum roadmap", people)).toEqual(["Vitalik Buterin"]);
    expect(mentionedPeople("Elon Musk comments on markets", people)).toEqual(["Elon Musk"]);
    expect(mentionedPeople("Blob fees fall again", people)).toEqual([]);
  });
});
