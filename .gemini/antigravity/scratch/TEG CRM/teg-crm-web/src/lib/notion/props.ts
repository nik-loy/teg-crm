export const title = (s: string) => ({ title: [{ text: { content: s } }] });
export const richText = (s: string) => ({ rich_text: [{ text: { content: s } }] });
export const select = (s: string) => ({ select: { name: s } });
export const url = (s: string) => ({ url: s });
export const date = (iso: string) => ({ date: { start: iso } });
export const relation = (pageId: string) => ({ relation: [{ id: pageId }] });
export const multiSelect = (values: string[]) => ({ multi_select: values.map(v => ({ name: v })) });
