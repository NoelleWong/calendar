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
          {/* On phones the nav drops to its own full-width row (and scrolls
              sideways if it still doesn't fit); from `sm` up it's one line. */}
          <header className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-4 py-2 sm:flex-nowrap sm:px-6 sm:py-3">
            <span className="text-sm font-semibold">Calendar</span>
            <nav className="order-last -mx-1 flex w-full gap-1 overflow-x-auto sm:order-none sm:mx-0 sm:w-auto sm:flex-1 sm:gap-3">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="shrink-0 px-1 py-1.5 text-sm text-graphite hover:text-ink sm:py-0"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto">
              <AuthButton />
            </div>
          </header>
          {children}
        </Providers>
      </body>
    </html>
  );
}
