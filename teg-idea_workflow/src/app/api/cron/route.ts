import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import {
  processNewDrafts,
  processStrategyDecisions,
  processDeptResponses,
  processReminders,
} from "@/core/processor";

// Runs the four phases in strict order to avoid race conditions.
export async function POST(req: NextRequest) {
  const start = Date.now();
  const auth = req.headers.get("authorization");

  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[cron] run started:", new Date().toISOString());

  const errors: string[] = [];

  async function safe<T>(name: string, fn: () => Promise<T>, fallback: T): Promise<T> {
    try { return await fn(); }
    catch (err) {
      const msg = `${name}: ${err instanceof Error ? err.message : String(err)}`;
      console.error("[cron]", msg);
      errors.push(msg);
      return fallback;
    }
  }

  const drafts = await safe("processNewDrafts", processNewDrafts, 0);
  const decisions = await safe("processStrategyDecisions", processStrategyDecisions, 0);
  const responses = await safe("processDeptResponses", processDeptResponses, 0);
  const reminders = await safe("processReminders", processReminders, 0);

  const durationMs = Date.now() - start;
  console.log("[cron] run complete:", { drafts, decisions, responses, reminders, durationMs });

  return NextResponse.json({
    processed: { drafts, decisions, responses, reminders },
    errors,
    duration_ms: durationMs,
  });
}
