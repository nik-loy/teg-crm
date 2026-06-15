import { z } from "zod";

const envSchema = z.object({
  NOTION_API_KEY: z.string().min(1),
  NOTION_IDEAS_DB_ID: z.string().min(1),
  NOTION_DEPT_RESPONSES_DB_ID: z.string().min(1),
  CRON_SECRET: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  FROM_EMAIL: z.string().email(),
  REPLY_TO_EMAIL: z.string().email().optional(),
  LEANTIME_URL: z.string().url(),
  LEANTIME_API_KEY: z.string().min(1),
  APP_URL: z.string().url(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Missing or invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error("Environment validation failed — check your .env.local file");
}

export const env = parsed.data;
