import { readFileSync } from "fs";
import { join } from "path";

export async function GET() {
  try {
    const configPath = join(process.cwd(), "config", "events-registry.json");
    const data = readFileSync(configPath, "utf-8");
    const events = JSON.parse(data);
    return Response.json({ events });
  } catch (e) {
    console.error("[api/events]", e);
    return Response.json({ events: [] });
  }
}
