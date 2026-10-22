import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SkipLink } from "@/components/layout/SkipLink";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://stockvision-pro.vercel.app";

export const viewport: Viewport = {
  themeColor: "#f8f9fa",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "StockVision Pro | Stock Price Forecasts from 10 Years of Market Data",
    template: "%s | StockVision Pro",
  },
  description:
    "Search any NSE, BSE or US-listed stock and see a next-day price forecast with directional accuracy, MAPE and RMSE measured on held-out data.",
  authors: [{ name: "StockVision Pro" }],
  openGraph: {
    type: "website",
    url: APP_URL,
    siteName: "StockVision Pro",
    title: "StockVision Pro | Stock Price Forecasts from 10 Years of Market Data",
    description:
      "Search any NSE, BSE or US-listed stock and see a next-day price forecast with directional accuracy, MAPE and RMSE measured on held-out data.",
    images: [
      {
        url: `${APP_URL}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "StockVision Pro — stock price forecasts based on historical data",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "StockVision Pro | Stock Price Forecasts from 10 Years of Market Data",
    description:
      "Search any NSE, BSE or US-listed stock and see a next-day price forecast with directional accuracy, MAPE and RMSE measured on held-out data.",
    images: [`${APP_URL}/opengraph-image`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.variable}>
        {/* Skip to main content — satisfies WCAG 2.4.1 */}
        <SkipLink />
        {children}
      </body>
    </html>
  );
}
