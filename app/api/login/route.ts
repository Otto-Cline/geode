import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, makeAuthCookieValue } from "@/lib/auth/cookie";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const expected = process.env.DEMO_PASSWORD;
  const secret = process.env.AUTH_SECRET;
  if (!expected || !secret) {
    return NextResponse.json(
      { error: "auth not configured (set DEMO_PASSWORD and AUTH_SECRET)" },
      { status: 500 },
    );
  }
  let body: { password?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (typeof body.password !== "string" || body.password !== expected) {
    return NextResponse.json({ error: "incorrect password" }, { status: 401 });
  }
  const value = await makeAuthCookieValue(secret);
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: AUTH_COOKIE_NAME,
    value,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 24 * 60 * 60,
  });
  return res;
}
