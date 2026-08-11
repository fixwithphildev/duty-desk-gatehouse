import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Duty Desk",
  description: "Resident Officer department operations platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
