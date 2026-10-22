import type { MetadataRoute } from "next";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://stockvision-pro.vercel.app";

/**
 * sitemap.ts — Static pages only.
 * /forecast/* pages are noindex and excluded per spec R8.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${APP_URL}/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${APP_URL}/methodology`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${APP_URL}/legal`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
