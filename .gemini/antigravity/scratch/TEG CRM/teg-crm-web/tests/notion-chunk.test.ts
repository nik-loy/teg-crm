import { describe, it, expect } from "vitest";
import { chunkString, richTextChunks, NOTION_TEXT_LIMIT } from "../src/lib/notion/chunk";
import { buildProfileArchiveBlocks } from "../src/lib/notion/profile-archive";

describe("chunkString", () => {
  it("returns a single chunk for short strings", () => {
    expect(chunkString("hello")).toEqual(["hello"]);
  });

  it("returns [] for empty input", () => {
    expect(chunkString("")).toEqual([]);
  });

  it("splits strings longer than the limit into multiple chunks", () => {
    const s = "a".repeat(5000);
    const chunks = chunkString(s);
    expect(chunks.length).toBe(3); // 2000 + 2000 + 1000
    expect(chunks.every((c) => c.length <= NOTION_TEXT_LIMIT)).toBe(true);
  });

  it("is lossless — concatenated chunks reproduce the input exactly", () => {
    const s = ("Lorem ipsum dolor sit amet ".repeat(400)).trim();
    expect(s.length).toBeGreaterThan(NOTION_TEXT_LIMIT);
    expect(chunkString(s).join("")).toBe(s);
  });

  it("is lossless even with no whitespace to break on", () => {
    const s = "x".repeat(4321);
    expect(chunkString(s).join("")).toBe(s);
  });

  it("prefers to break on a newline near the boundary", () => {
    const line = "y".repeat(1900);
    const s = line + "\n" + "z".repeat(1900);
    const chunks = chunkString(s);
    expect(chunks[0].endsWith("\n")).toBe(true);
    expect(chunks.join("")).toBe(s);
  });
});

describe("richTextChunks", () => {
  it("matches the legacy single-object shape for short text", () => {
    expect(richTextChunks("hello")).toEqual({ rich_text: [{ text: { content: "hello" } }] });
  });

  it("produces multiple rich-text objects for long text, each within the limit", () => {
    const { rich_text } = richTextChunks("q".repeat(5000));
    expect(rich_text.length).toBe(3);
    expect(rich_text.every((rt) => rt.text.content.length <= NOTION_TEXT_LIMIT)).toBe(true);
  });
});

describe("buildProfileArchiveBlocks", () => {
  it("returns [] for empty paste", () => {
    expect(buildProfileArchiveBlocks("   ", "2026-06-12")).toEqual([]);
  });

  it("starts with a dated heading then chunked paragraphs, losslessly", () => {
    const raw = "Anna Müller\nVP Engineering\n" + "details ".repeat(400);
    const blocks = buildProfileArchiveBlocks(raw, "2026-06-12") as Array<Record<string, unknown>>;
    expect(blocks[0]).toMatchObject({ type: "heading_3" });
    expect((blocks[0].heading_3 as { rich_text: { text: { content: string } }[] }).rich_text[0].text.content).toContain("2026-06-12");

    const paras = blocks.slice(1) as Array<{ paragraph: { rich_text: { text: { content: string } }[] } }>;
    const reconstructed = paras.map((b) => b.paragraph.rich_text[0].text.content).join("");
    expect(reconstructed).toBe(raw.trim());
    expect(paras.every((b) => b.paragraph.rich_text[0].text.content.length <= NOTION_TEXT_LIMIT)).toBe(true);
  });
});
