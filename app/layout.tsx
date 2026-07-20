import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Calendar",
  description: "Weekly time-block calendar with project bubbles.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
