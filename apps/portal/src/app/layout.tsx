import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Destination — Operations Portal",
  description: "Entry point for Duty Desk and Gatehouse",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
