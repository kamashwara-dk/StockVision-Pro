# Change notes — StockVision Pro rebuild

This document records what changed from the old site, what was removed, and the reason for each decision. It maps directly to spec §2 ("Remove from the current site").

---

## Removed features

| Feature | Why removed |
|---|---|
| Login / signup / Supabase Auth flows | Spec §2. No user accounts in the new product. |
| `/dashboard` and all sub-pages | Spec §2. Portfolio tracking and brokerage linking removed. |
| `/login`, `/signup`, `/forgot-password`, `/reset-password` | Follows from auth removal. |
| Portfolio and holdings context (`PortfolioProvider`) | Spec §2. Multi-currency portfolio removed. |
| Scenario analysis panel (`ScenarioPanel`) | Spec §2. |
| News sentiment (`MarketPulse`, mock news data) | Spec §2. |
| Risk alerts | Spec §2. |
| Crypto support | Spec §2. |
| Multi-currency portfolio display | Spec §2. |
| Dashboard screenshot (`public/dashboard-preview.png` still present but no longer rendered) | Spec §2. |
| Hardcoded ticker marquee (`Ticker.tsx`) | Spec §2. |
| Social icons and every `href="#"` footer link | Spec §2. |

## Removed claims

| Claim | Reason |
|---|---|
| "89% prediction accuracy" | Unverifiable hardcoded statistic. Spec §2. |
| "12,400+ investors" | Unverifiable. Spec §2. |
| "$2.4B tracked" | Unverifiable. Spec §2. |
| "millisecond accuracy" | Unverifiable. Spec §2. |
| "high confidence" | Spec §6 banned phrase. |
| "proprietary" | Spec §6 banned word. |
| "we read thousands of articles a second" | Unverifiable. Spec §2. |
| "30/60/90-day price targets" | Spec §2. Only next-day forecast is produced. |
| "AI-Powered Market Intelligence" in title, meta, OG, Twitter tags | Spec §2 and §6. |
| Bull case / bear case multipliers (±15%) | Hardcoded fiction. Removed. |
| `confidence` score derived from R² clamped to 30–95 | Misleading presentation of an in-sample metric. Removed entirely. |

## Removed branding

| Element | Replacement |
|---|---|
| Dark navy theme (`#0A0F1E`) | Light neutral grey (`#f8f9fa`) with blue accent `#1d4ed8` |
| `--primary-bg`, `--accent: #00E5A0` design tokens | New token set in `globals.css` |
| Glassmorphism, glow effects, gradient backgrounds | Removed. Plain borders and solid backgrounds only. |
| "Invest Smarter. Predict Bolder." | Removed. |
| "AI-Powered Market Intelligence" | Removed from all metadata. |

## Removed or replaced files

| Old file | Disposition |
|---|---|
| `app/api/predict/route.ts` | Deleted. Replaced by `/api/forecasts` (proxies to model service). |
| `app/api/quote/route.ts` | Deleted. Quote endpoint not in new API contract. |
| `app/api/auth/login/route.ts` | Deleted. Auth removed. |
| `app/api/auth/signup/route.ts` | Deleted. Auth removed. |
| `app/auth/confirm/route.ts` | Deleted. Auth removed. |
| `app/auth/signout/route.ts` | Deleted. Auth removed. |
| `app/login/actions.ts` | Deleted. Auth removed. |
| `app/dashboard/**` | Deleted. Dashboard removed. |
| `app/stock/[symbol]/page.tsx` | Deleted. Replaced by `/forecast/[ticker]`. |
| `app/login/page.tsx`, `signup/page.tsx`, `forgot-password/page.tsx`, `reset-password/page.tsx` | Deleted. Auth removed. |
| `components/dashboard/**` | Deleted. Dashboard removed. |
| `components/landing/Navbar.tsx` | Deleted. Replaced by `SiteNav`. |
| `components/landing/Hero.tsx` | Deleted. Replaced by `app/page.tsx`. |
| `components/landing/Footer.tsx` | Deleted. Replaced by `SiteFooter`. |
| `components/landing/Ticker.tsx` | Deleted. Hardcoded marquee removed. |
| `components/landing/Features.tsx` | Deleted. |
| `components/landing/HowItWorks.tsx` | Deleted. |
| `components/landing/DashboardPreview.tsx` | Deleted. Dashboard screenshot removed. |
| `components/providers/PortfolioProvider.tsx` | Deleted. Portfolio removed. |
| `components/ui/PasswordInput.tsx` | Deleted. Auth removed. |
| `components/ui/StatCard.tsx` | Deleted. Replaced by inline cards in `ForecastResult`. |
| `lib/api.ts` | Deleted. Replaced by `lib/modelClient.ts`. |
| `lib/mockData.ts` | Deleted. All mock data removed. |
| `lib/types.ts` | Rewritten. Now contains only forecast domain types. |
| `utils/supabase/client.ts` | Deleted. No browser Supabase access. |
| `utils/supabase/server.ts` | Deleted. Replaced by `lib/supabaseAdmin.ts`. |
| `utils/supabase/middleware.ts` | Deleted. Auth logic removed from proxy. |
| `utils/supabase/getUser.ts` | Deleted. Auth removed. |
| `proxy.ts` | Rewritten. Now only attaches a request ID header. |
| `scripts/create-admin.js`, `scripts/update-users.js` | Left in place; inert without auth tables. |

## No database tables were dropped

The existing Supabase project had no custom tables — only the built-in `auth.users` table from Supabase Auth. Since `auth.users` is a Supabase system table, it cannot be renamed with an `archived_` prefix. It was left untouched.

Two new tables were created by migration `0001_initial_schema.sql`:
- `price_history_cache`
- `forecast_runs`

## Architecture changes

| Old | New | Reason |
|---|---|---|
| OLS regression in TypeScript, `app/api/predict/route.ts`, 1 year of data | `HistGradientBoostingRegressor` in Python, model service, up to 10 years | Spec §3, §1. Serverless limit exceeded by training. |
| No validation, no walk-forward eval, no held-out metrics | Full pipeline: validation → features → walk-forward → metrics | Spec R2–R4. |
| `@supabase/ssr` browser auth client | Removed. `lib/supabaseAdmin.ts` uses service role server-side only | Spec R8. Browser never sees any Supabase key. |
| `framer-motion` animations | Removed. No animations in new design. | Spec R7. |
| Exchange rate API call from browser (`PortfolioProvider`) | Removed. | Portfolio feature removed. |
| `proxy.ts` used for Supabase auth session refresh | `proxy.ts` rewritten — only attaches request ID header. | Auth removed. |

## What was kept

- Next.js App Router, Vercel deployment target.
- NSE / BSE / US market focus.
- `opengraph-image.tsx` route (rewritten with new copy).
- Recharts (already installed; used for the forecast chart).
- `@supabase/supabase-js` (used server-side only via `supabaseAdmin.ts`).
- `lib/utils.ts` (`cn()` helper).
- `lib/appUrl.ts`.
- `vercel.json` (updated for new routes and function timeouts).
