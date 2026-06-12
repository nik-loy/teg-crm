export interface Connection {
  name: string;
  headline: string;
  connectedOn: string; // ISO date "2026-06-12"
  linkedinUrl?: string;
}

export interface ConnectionParseResult {
  success: boolean;
  connections: Connection[];
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
