/**
 * Returns the absolute base URL of the app.
 * Works on Vercel (VERCEL_URL), local dev (NEXT_PUBLIC_APP_URL), and fallback.
 *
 * Use this anywhere you need an absolute URL for Supabase email callbacks.
 */
export function getAppUrl(): string {
  // Vercel sets VERCEL_URL automatically (without https://)
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  // Explicit override (e.g. custom domain)
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  return "http://localhost:3000";
}
