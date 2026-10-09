import type { Metadata, Viewport } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import "./suite.css";

// Operations Suite type: Inter for the interface, Instrument Serif for the
// large display headings, Geist Mono for numbers, codes and times.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const instrument = Instrument_Serif({ subsets: ["latin"], weight: "400", variable: "--font-instrument", display: "swap" });

export const metadata: Metadata = {
  title: "Duty Desk",
  description: "Resident Officer department operations platform",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F5F2" },
    { media: "(prefers-color-scheme: dark)", color: "#090D12" },
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
    <html lang="en" className={`${inter.variable} ${instrument.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BEFORE_PAINT }} />
        {/* Geist Mono isn't in this Next.js version's built-in font list, so it loads from Google Fonts. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500;600&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
