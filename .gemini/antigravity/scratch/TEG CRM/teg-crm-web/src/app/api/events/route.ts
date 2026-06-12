import { getEventsRegistry } from "@/lib/config";

export async function GET() {
  return Response.json({ events: getEventsRegistry() });
}
