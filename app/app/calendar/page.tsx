"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { currentWeekId } from "@/lib/weeks";

/**
 * /calendar → this week. Resolved in the browser so "this week" follows the
 * user's own calendar date, not the server's timezone or build time.
 */
export default function CalendarIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/calendar/${currentWeekId()}`);
  }, [router]);
  return (
    <main className="p-4 sm:p-6">
      <p className="text-sm text-graphite">Loading…</p>
    </main>
  );
}
