export interface PendingRequest {
  name: string;
  headline: string;
  sentDaysAgo?: number;
  sentDate?: string;
  linkedinUrl?: string;
}

export interface ParseResult {
  success: boolean;
  requests: PendingRequest[];
  errors: Array<{
    lineNumber?: number;
    reason: string;
    rawText?: string;
  }>;
  stats: {
    totalLines: number;
    parsed: number;
    failed: number;
    duplicateDetected: number;
  };
}
