"use client";

import { signIn, signOut, useSession } from "next-auth/react";

export function AuthButton() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <span className="text-sm text-graphite">…</span>;
  }

  if (!session) {
    return (
      <button
        onClick={() => signIn("google")}
        className="text-sm text-graphite hover:text-ink"
      >
        Sign in with Google
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-graphite">{session.user?.email}</span>
      <button
        onClick={() => signOut()}
        className="text-sm text-graphite hover:text-ink"
      >
        Sign out
      </button>
    </div>
  );
}
