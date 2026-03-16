"use client";

import Link from "next/link";
import { createClient as createBrowserClient } from "@/lib/supabase-browser";

interface AdminAccessGateProps {
  mode: "signin" | "forbidden";
  email?: string | null;
}

export default function AdminAccessGate({ mode, email }: AdminAccessGateProps) {
  const handleSignIn = async () => {
    const supabase = createBrowserClient();
    const redirectTo = new URL("/auth/callback", window.location.origin);
    redirectTo.searchParams.set("next", "/admin");

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectTo.toString(),
      },
    });
  };

  const handleSignOut = async () => {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 p-8 ring-1 ring-zinc-200 dark:ring-white/10">
        <h1 className="mb-2 text-lg font-bold text-zinc-900 dark:text-zinc-100">
          Admin Access
        </h1>
        <p
          className="mb-6 text-base text-zinc-400 dark:text-zinc-500"
          style={{ fontFamily: "'Caveat', cursive" }}
        >
          Aestara
        </p>

        {mode === "signin" ? (
          <>
            <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
              Sign in with the approved Google account to manage the gallery.
            </p>
            <button
              onClick={handleSignIn}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 dark:bg-white py-2.5 text-sm font-semibold text-white dark:text-zinc-900 transition-colors hover:bg-zinc-700 dark:hover:bg-zinc-200"
            >
              Continue with Google
            </button>
          </>
        ) : (
          <>
            <p className="mb-2 text-sm text-zinc-500 dark:text-zinc-400">
              This account is signed in, but it is not allowed to access the admin area.
            </p>
            {email && (
              <p className="mb-6 rounded-lg bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400 ring-1 ring-zinc-200 dark:ring-white/5">
                Signed in as {email}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleSignOut}
                className="flex-1 rounded-lg bg-zinc-900 dark:bg-white py-2.5 text-sm font-semibold text-white dark:text-zinc-900 transition-colors hover:bg-zinc-700 dark:hover:bg-zinc-200"
              >
                Sign out
              </button>
              <Link
                href="/"
                className="flex-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 py-2.5 text-center text-sm font-medium text-zinc-600 dark:text-zinc-300 transition-colors hover:bg-zinc-200 dark:hover:bg-zinc-700"
              >
                Back home
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
