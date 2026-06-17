function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export const env = {
  geminiKey: () => process.env.GEMINI_API_KEY ?? "",
  appPassword: () => req("APP_PASSWORD"),
  authSecret: () => req("AUTH_SECRET"),
};
