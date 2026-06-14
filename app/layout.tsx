import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const APP_URL = "https://stockvision-pro.vercel.app";

export const viewport: Viewport = {
  themeColor: "#0A0F1E",
  colorScheme: "dark",
};

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "StockVision Pro | AI-Powered Market Intelligence",
    template: "%s | StockVision Pro",
  },
  description:
    "Invest Smarter. Predict Bolder. AI-powered stock portfolio dashboard with real-time ML forecasts, Indian & global market overview, and multi-currency support.",
  keywords: [
    "stock market", "AI predictions", "portfolio tracker", "NSE", "BSE",
    "Nifty", "Sensex", "S&P 500", "NASDAQ", "investment dashboard",
  ],
  authors: [{ name: "StockVision Pro" }],
  creator: "StockVision Pro",

  // ── Open Graph (WhatsApp, Facebook, LinkedIn, Discord) ──
  openGraph: {
    type: "website",
    url: APP_URL,
    siteName: "StockVision Pro",
    title: "StockVision Pro | AI-Powered Market Intelligence",
    description:
      "Real-time portfolio tracking · ML price forecasts · Indian & global markets · Multi-currency",
    images: [
      {
        url: `${APP_URL}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "StockVision Pro — AI-Powered Market Intelligence",
      },
    ],
  },

  // ── Twitter / X card ──
  twitter: {
    card: "summary_large_image",
    title: "StockVision Pro | AI-Powered Market Intelligence",
    description:
      "Real-time portfolio tracking · ML price forecasts · Indian & global markets",
    images: [`${APP_URL}/opengraph-image`],
  },

  // ── Icons ──
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/icon.svg",
  },

  // ── Theme ──  (moved to viewport export above)

  // ── Robots ──
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
