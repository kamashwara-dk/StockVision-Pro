import type { MetadataRoute } from "next";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://stockvision-pro.vercel.app";

/**
 * robots.ts — Allow indexing of static pages; block /forecast/* per spec R8.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/methodology", "/legal"],
        disallow: ["/forecast/"],
      },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
