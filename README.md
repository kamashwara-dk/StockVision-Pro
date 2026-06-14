# StockVision Pro

AI-powered stock portfolio dashboard with real-time prices, ML predictions, and Indian + global market overview.

## Tech Stack

- **Framework**: Next.js 16.2 (App Router)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS v4
- **Auth + DB**: Supabase
- **Charts**: Recharts
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Data**: Yahoo Finance (no API key required)

## Features

- Live portfolio tracking with real-time prices
- ML-powered price predictions with day-by-day forecast table
- Indian & global market overview (BSE Sensex, Nifty, S&P 500, NASDAQ, etc.)
- Multi-currency support (USD, INR, EUR, GBP, AED, SAR + more)
- Separate login / signup / forgot-password pages
- No email verification — instant account access
- AI scenario analysis panel
- Responsive design with mobile hamburger menu

## Local Development

### 1. Clone and install

```bash
git clone https://github.com/kamashwara-dk/StockVision-Pro
cd StockVision-Pro
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Run dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Admin credentials (after running create-admin script)

```
Email:    admin@stockvision.pro
Password: AdminSecure123!
```

To create the admin account:
```bash
node scripts/create-admin.js
```

## Deploy to Vercel

### 1. Push to GitHub (already done)

### 2. Import on Vercel

Go to [vercel.com/new](https://vercel.com/new) → Import from GitHub → select `StockVision-Pro`

### 3. Add environment variables in Vercel dashboard

In **Project Settings → Environment Variables**, add all of these:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | your Supabase service role key |
| `NEXT_PUBLIC_APP_URL` | `https://your-project.vercel.app` (set after first deploy) |

### 4. Configure Supabase redirect URLs

In **Supabase → Authentication → URL Configuration**:

- Site URL: `https://your-project.vercel.app`
- Redirect URLs: add `https://your-project.vercel.app/auth/confirm`

### 5. Deploy

Vercel auto-deploys on every push to `main`. The `vercel.json` is already configured with:
- Region: `sin1` (Singapore — closest to India)
- `/api/predict` timeout: 60s (ML computation)
- `/api/quote` timeout: 15s

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── auth/login/     # Route handler (fixes cookie flush issue)
│   │   ├── auth/signup/    # Auto-confirms accounts (no email verification)
│   │   ├── predict/        # ML forecast engine (OLS regression)
│   │   └── quote/          # Real-time Yahoo Finance quotes
│   ├── auth/
│   │   ├── confirm/        # Supabase email confirmation handler
│   │   └── signout/        # Sign-out route handler
│   ├── dashboard/          # Protected pages (Overview, Portfolio, Predictions, Markets)
│   ├── login/              # Sign in page
│   ├── signup/             # Create account page
│   ├── forgot-password/    # Password reset request
│   ├── reset-password/     # Set new password
│   └── stock/[symbol]/     # Individual stock detail + forecast
├── components/
│   ├── dashboard/          # All dashboard widgets
│   ├── landing/            # Landing page sections
│   ├── providers/          # PortfolioProvider (context + currency conversion)
│   └── ui/                 # Shared UI primitives
├── lib/
│   ├── api.ts              # Client-side API calls
│   ├── mockData.ts         # Fallback mock data
│   ├── types.ts            # TypeScript interfaces
│   └── utils.ts            # cn() helper
└── utils/supabase/         # Supabase client helpers
```
