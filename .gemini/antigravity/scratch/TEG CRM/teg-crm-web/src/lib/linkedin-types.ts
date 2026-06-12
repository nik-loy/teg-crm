import { z } from 'zod';

export const RawLinkedInRecordSchema = z.object({
  name: z.string().trim().min(1, 'Name required'),
  headline: z.string().trim(),
  company: z.string().trim(),
  sentAt: z.string().trim().nullable(),
  rawText: z.string(), // Original unparsed line for audit
});

export type RawLinkedInRecord = z.infer<typeof RawLinkedInRecordSchema>;

export const EnrichedRecordSchema = RawLinkedInRecordSchema.extend({
  companyDomain: z.string().nullable(),
  industry: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

export type EnrichedRecord = z.infer<typeof EnrichedRecordSchema>;

// Validation result for frontend
export const ParseResultSchema = z.object({
  success: z.boolean(),
  records: z.array(EnrichedRecordSchema),
  errors: z.array(z.object({
    lineNumber: z.number(),
    rawText: z.string(),
    reason: z.string(),
  })),
  stats: z.object({
    totalLines: z.number(),
    parsed: z.number(),
    failed: z.number(),
  }),
});

export type ParseResult = z.infer<typeof ParseResultSchema>;
