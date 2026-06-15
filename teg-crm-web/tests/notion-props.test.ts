import { describe, it, expect } from "vitest";
import { title, select, url, date, richText, relation } from "../src/lib/notion/props";

describe("notion props", () => {
  it("builds title", () => {
    expect(title("Anna")).toEqual({ title: [{ text: { content: "Anna" } }] });
  });
  it("builds select", () => {
    expect(select("Tier 1")).toEqual({ select: { name: "Tier 1" } });
  });
  it("builds richText", () => {
    expect(richText("hello")).toEqual({ rich_text: [{ text: { content: "hello" } }] });
  });
  it("builds url", () => {
    expect(url("https://x")).toEqual({ url: "https://x" });
  });
  it("builds date", () => {
    expect(date("2026-06-03")).toEqual({ date: { start: "2026-06-03" } });
  });
  it("builds relation", () => {
    expect(relation("pid")).toEqual({ relation: [{ id: "pid" }] });
  });
});
