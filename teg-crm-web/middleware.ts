import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PAYLOAD = "teg-crm-authed";

async function verifySessionEdge(token: string | undefined, secret: string): Promise<boolean> {
  if (!token) return false;
  const enc = new TextEncoder();
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const sigBytes = Uint8Array.from(
    parts[1].match(/.{2}/g)?.map((b) => parseInt(b, 16)) ?? []
  );
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  return crypto.subtle.verify("HMAC", key, sigBytes, enc.encode(PAYLOAD));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const open =
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico";
  if (open) return NextResponse.next();

  const secret = process.env.AUTH_SECRET ?? "";
  const ok = await verifySessionEdge(req.cookies.get("teg_session")?.value, secret);
  if (!ok) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
