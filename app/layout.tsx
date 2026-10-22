import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://stockvision-pro.vercel.app";

export const viewport: Viewport = {
  themeColor: "#0A0F1E",
  colorScheme: "dark",
};

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "StockVision Pro | Stock Price Forecasts from Market Data",
    template: "%s | StockVision Pro",
  },
  description:
    "Track your portfolio, view delayed quotes from NSE, BSE, NYSE and NASDAQ, and get next-day price forecasts with accuracy measured on held-out data.",
  keywords: [
    "stock market", "price forecast", "portfolio tracker", "NSE", "BSE",
    "Nifty", "Sensex", "S&P 500", "NASDAQ", "stock analysis",
  ],
  authors: [{ name: "StockVision Pro" }],
  creator: "StockVision Pro",

  openGraph: {
    type: "website",
    url: APP_URL,
    siteName: "StockVision Pro",
    title: "StockVision Pro | Stock Price Forecasts from Market Data",
    description:
      "Portfolio tracking · Price forecasts from historical data · NSE, BSE, NYSE, NASDAQ · Delayed quotes",
    images: [
      {
        url: `${APP_URL}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "StockVision Pro — stock price forecasts from historical market data",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "StockVision Pro | Stock Price Forecasts from Market Data",
    description:
      "Portfolio tracking · Price forecasts · NSE, BSE, NYSE, NASDAQ",
    images: [`${APP_URL}/opengraph-image`],
  },

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
