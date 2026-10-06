import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const serif = Fraunces({ subsets: ["latin"], axes: ["opsz"], variable: "--font-serif", display: "swap" });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Duty Desk",
  description: "Resident Officer department operations platform",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5F1E9" },
    { media: "(prefers-color-scheme: dark)", color: "#12100D" },
  ],
};

// Applies the theme the viewer last picked before first paint, so there's
// no flash of the wrong one. With no saved choice, the CSS follows the
// device's light/dark setting.
const THEME_BEFORE_PAINT = `try { var t = localStorage.getItem("dd-theme"); if (t === "light" || t === "dark") document.documentElement.dataset.theme = t; } catch (e) {}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the script above may set data-theme on
    // <html> before React hydrates.
    <html lang="en" className={`${serif.variable} ${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BEFORE_PAINT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
