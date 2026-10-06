import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], axes: ["opsz"], variable: "--font-serif", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: "The Destination — Operations Portal",
  description: "Entry point for Duty Desk, Gatehouse and Maintenance Desk",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#EFEAE0" },
    { media: "(prefers-color-scheme: dark)", color: "#0B0D10" },
  ],
};

// Runs before first paint, so there's no flash of the wrong theme and the
// cards are already hidden if the intro is about to play:
// - theme: the one the viewer last picked, otherwise the device setting
// - entrance: the full intro once per browser session, a quick card rise
//   after that, and nothing at all for anyone with reduced motion on
const BEFORE_PAINT = `
try { var t = localStorage.getItem("portal-theme"); if (t === "light" || t === "dark") document.documentElement.dataset.theme = t; } catch (e) {}
(function () {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var seen = false;
  try { seen = sessionStorage.getItem("portal-intro-seen") === "1"; } catch (e) {}
  if (/[?&]intro(=|&|$)/.test(location.search)) seen = false;
  document.documentElement.classList.add("enter");
  if (!seen) document.documentElement.classList.add("intro-show");
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the script above sets data-theme and the
    // entrance classes on <html> before React hydrates.
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: BEFORE_PAINT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
