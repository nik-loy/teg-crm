import { createHmac, timingSafeEqual } from "crypto";

const PAYLOAD = "teg-crm-authed";

export function signSession(secret: string): string {
  const sig = createHmac("sha256", secret).update(PAYLOAD).digest("hex");
  return `${PAYLOAD}.${sig}`;
}

export function verifySession(token: string | undefined, secret: string): boolean {
  if (!token) return false;
  const expected = signSession(secret);
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
