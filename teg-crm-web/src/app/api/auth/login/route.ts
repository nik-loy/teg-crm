import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { signSession } from "@/lib/auth";
import { getBackendUrl } from "@/lib/backend";

export async function POST(req: Request) {
  const { password } = await req.json();
  if (password !== env.appPassword()) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let jwtToken = "";
  try {
    const backendUrl = getBackendUrl();
    const djangoRes = await fetch(`${backendUrl}/api/auth/login/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "TEG", password }),
    });
    if (djangoRes.ok) {
      const data = await djangoRes.json();
      jwtToken = data.access;
    } else {
      console.error("[login/api] Django auth failed:", await djangoRes.text());
    }
  } catch (err) {
    console.error("[login/api] Failed to contact Django backend:", err);
  }

  const res = NextResponse.json({ ok: true, token: jwtToken });
  res.cookies.set("teg_session", signSession(env.authSecret()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" && req.headers.get("x-forwarded-proto") === "https",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  if (jwtToken) {
    res.cookies.set("teg_jwt", jwtToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production" && req.headers.get("x-forwarded-proto") === "https",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return res;
}
