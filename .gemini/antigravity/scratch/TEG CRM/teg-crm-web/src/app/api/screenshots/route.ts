import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { extractFromImage } from "@/lib/extraction/screenshot";

export async function POST(req: Request) {
  const apiKey = env.openaiKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: "OpenAI API key not configured" },
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
    const results = await Promise.all(
      images.map((b64) => extractFromImage(b64, apiKey))
    );
    const contacts = results.flat();
    return NextResponse.json({ contacts });
  } catch (e) {
    console.error("[screenshots]", e);
    return NextResponse.json(
      { error: "Vision extraction failed" },
      { status: 500 }
    );
  }
}
