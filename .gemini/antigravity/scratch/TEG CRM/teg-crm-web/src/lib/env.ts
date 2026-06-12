function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export const env = {
  notionToken: () => req("NOTION_TOKEN"),
  contactsDb: () => req("NOTION_CONTACTS_DB_ID"),
  companiesDb: () => process.env.NOTION_COMPANIES_DB_ID ?? "",
  interactionsDb: () => req("NOTION_INTERACTIONS_DB_ID"),
  geminiKey: () => process.env.GEMINI_API_KEY ?? "",
  openaiKey: () => process.env.OPENAI_API_KEY ?? "",
  anthropicKey: () => process.env.ANTHROPIC_API_KEY ?? "",
  appPassword: () => req("APP_PASSWORD"),
  authSecret: () => req("AUTH_SECRET"),
};
