import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { extractFromImage } from "@/lib/extraction/screenshot";

export async function POST(req: Request) {
  const geminiKey = env.geminiKey();

  if (!geminiKey) {
    return NextResponse.json(
      { error: "No vision API configured (set GEMINI_API_KEY)" },
      { status: 501 }
    );
  }

  const body = await req.json();
  const images: string[] | undefined = body.images;

  if (!Array.isArray(images) || images.length === 0) {
    return NextResponse.json(
      { error: "images must be a non-empty array of base64 strings" },
      { status: 400 }
    );
  }

  if (images.length > 20) {
    return NextResponse.json(
      { error: "Maximum 20 images per request" },
      { status: 400 }
    );
  }

  try {
    console.log("[screenshots] Processing", images.length, "images");
    const results = await Promise.all(
      images.map((b64, idx) => {
        console.log(`[screenshots] Image ${idx + 1}/${images.length}: base64 length ${b64.length}`);
        return extractFromImage(b64, geminiKey);
      })
    );
    const contacts = results.flat();
    console.log("[screenshots] Success: extracted", contacts.length, "total contacts");
    return NextResponse.json({ contacts });
  } catch (e) {
    const errorMsg =
      e instanceof Error ? e.message : "Vision extraction failed";
    console.error("[screenshots] Fatal error:", errorMsg, e);
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}

