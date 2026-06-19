import "./globals.css";
import type { Metadata, Viewport } from "next";
import { StoreProvider } from "@/lib/store";

export const metadata: Metadata = {
  title: "Fiscal · Expense & Financial Intelligence",
  description:
    "Offline-first expense intelligence: splitting, automation, run-rate modeling, and financial psychology.",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Fiscal" },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/icon-180.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0b1020",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}
