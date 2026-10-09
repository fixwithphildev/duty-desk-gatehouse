import type { Metadata, Viewport } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import "./suite.css";

// Operations Suite type: Inter for the interface, Instrument Serif for the
// large display headings, Geist Mono for numbers, codes and times.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const instrument = Instrument_Serif({ subsets: ["latin"], weight: "400", variable: "--font-instrument", display: "swap" });

export const metadata: Metadata = {
  title: "Gatehouse",
  description: "Security operations platform",
};

export const viewport: Viewport = { themeColor: "#090D12" };

// Gatehouse is always dark: one desk at the gate, used day and night.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={`${inter.variable} ${instrument.variable}`}>
      <head>
        {/* Geist Mono isn't in this Next.js version's built-in font list, so it loads from Google Fonts. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500;600&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
