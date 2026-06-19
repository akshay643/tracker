import type { MetadataRoute } from "next";

// Served at /manifest.webmanifest — makes the app installable as a PWA.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Fiscal · Expense Intelligence",
    short_name: "Fiscal",
    description: "Offline-first expense tracking with reminders, budgets and insights.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b1020",
    theme_color: "#0b1020",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
