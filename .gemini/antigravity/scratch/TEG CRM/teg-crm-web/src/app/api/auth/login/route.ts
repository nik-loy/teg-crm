import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { signSession } from "@/lib/auth";

export async function POST(req: Request) {
  const { password } = await req.json();
  if (password !== env.appPassword()) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set("teg_session", signSession(env.authSecret()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
