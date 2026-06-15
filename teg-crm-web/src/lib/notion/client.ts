import { Client } from "@notionhq/client";

let _c: Client | null = null;

export function notion(): Client {
  if (!_c) _c = new Client({ auth: process.env.NOTION_TOKEN! });
  return _c;
}

export async function withRetry<T>(fn: () => Promise<T>, tries = 5): Promise<T> {
  let delay = 400;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e: unknown) {
      const code = (e as { status?: number; code?: number })?.status ??
                   (e as { status?: number; code?: number })?.code;
      const retryable = code === 429 || (typeof code === "number" && code >= 500);
      if (!retryable || i === tries - 1) throw e;
      await new Promise((r) => setTimeout(r, delay));
      delay *= 2;
    }
  }
  throw new Error("unreachable");
}
