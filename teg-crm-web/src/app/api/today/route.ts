import { NextResponse } from "next/server";
import { getTodayBuckets } from "@/lib/backend";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const owner = searchParams.get("owner") ?? undefined;
    const buckets = await getTodayBuckets(owner);
    return NextResponse.json(buckets);
  } catch (e) {
    console.error("[today]", e);
    return NextResponse.json({ error: "Failed to fetch today queue" }, { status: 500 });
  }
}
