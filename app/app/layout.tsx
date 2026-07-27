import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { AuthButton } from "@/components/AuthButton";

export const metadata: Metadata = {
  title: "Calendar",
  description: "Weekly time-block calendar with project bubbles.",
};

/** ISO week string, e.g. "2026-W30" (Monday-start), for the nav's Calendar link. */
function currentIsoWeekId(): string {
  const now = new Date();
  const date = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7; // 0 = Monday
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // nearest Thursday
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const weekNum =
    1 + Math.round(((date.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const navLinks = [
    { href: `/calendar/${currentIsoWeekId()}`, label: "Calendar" },
    { href: "/projects", label: "Projects" },
    { href: "/templates", label: "Templates" },
    { href: "/compare", label: "Compare" },
  ];

  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        <Providers>
          <header className="flex items-center gap-4 border-b border-line px-6 py-3">
            <span className="text-sm font-semibold">Calendar</span>
            <nav className="flex flex-1 gap-3">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-graphite hover:text-ink"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <AuthButton />
          </header>
          {children}
        </Providers>
      </body>
    </html>
  );
}
