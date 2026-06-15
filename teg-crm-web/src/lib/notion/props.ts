import { richTextChunks } from "./chunk";

export const title = (s: string) => ({ title: [{ text: { content: s } }] });
// Chunked so values over Notion's 2000-char rich-text limit (e.g. a full
// LinkedIn profile) no longer make the API reject the whole write.
export const richText = (s: string) => richTextChunks(s);
export const select = (s: string) => ({ select: { name: s } });
export const url = (s: string) => ({ url: s });
export const date = (iso: string) => ({ date: { start: iso } });
export const relation = (pageId: string) => ({ relation: [{ id: pageId }] });
export const multiSelect = (values: string[]) => ({ multi_select: values.map(v => ({ name: v })) });
export const checkbox = (b: boolean) => ({ checkbox: b });
