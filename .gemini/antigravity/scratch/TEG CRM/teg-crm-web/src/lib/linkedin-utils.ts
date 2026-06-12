export function extractNameFromLinkedInUrl(url: string): string {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    const pathname = parsed.pathname.toLowerCase();

    // Pattern: /in/username or /company/name
    const match = pathname.match(/\/in\/([a-z0-9-]+)/);
    if (match && match[1]) {
      // Convert "john-doe" to "John Doe"
      const name = match[1]
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
      return name;
    }
  } catch {
    // ignore parsing errors
  }
  return "";
}
