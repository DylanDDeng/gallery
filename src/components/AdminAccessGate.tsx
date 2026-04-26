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
    <div className="flex min-h-screen items-center justify-center bg-[#ebe7e0] dark:bg-[#0c0b09] px-4">
      <div className="w-full max-w-md rounded-2xl bg-[#f5f2ed] dark:bg-[#141210] p-8 ring-1 ring-[#d5cfc4] dark:ring-[#c4bdb4]/10">
        <h1 className="mb-2 text-lg font-bold text-[#141210] dark:text-[#e0d9ce]">
          Admin Access
        </h1>
        <p
          className="mb-6 text-base text-[#8a837a] dark:text-[#5c564e]"
          style={{ fontFamily: "'Caveat', cursive" }}
        >
          Aestara
        </p>

        {mode === "signin" ? (
          <>
            <p className="mb-6 text-sm text-[#5c564e] dark:text-[#8a837a]">
              Sign in with the approved Google account to manage the gallery.
            </p>
            <button
              onClick={handleSignIn}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#141210] dark:bg-[#f5f2ed] py-2.5 text-sm font-semibold text-[#f5f2ed] dark:text-[#141210] transition-colors hover:bg-[#2a2520] dark:hover:bg-[#d5cfc4]"
            >
              Continue with Google
            </button>
          </>
        ) : (
          <>
            <p className="mb-2 text-sm text-[#5c564e] dark:text-[#8a837a]">
              This account is signed in, but it is not allowed to access the admin area.
            </p>
            {email && (
              <p className="mb-6 rounded-lg bg-[#ebe7e0] dark:bg-[#1a1814] px-3 py-2 text-xs text-[#5c564e] dark:text-[#8a837a] ring-1 ring-[#d5cfc4] dark:ring-white/5">
                Signed in as {email}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleSignOut}
                className="flex-1 rounded-lg bg-[#141210] dark:bg-[#f5f2ed] py-2.5 text-sm font-semibold text-[#f5f2ed] dark:text-[#141210] transition-colors hover:bg-[#2a2520] dark:hover:bg-[#d5cfc4]"
              >
                Sign out
              </button>
              <Link
                href="/"
                className="flex-1 rounded-lg bg-[#e0d9ce] dark:bg-[#1a1814] py-2.5 text-center text-sm font-medium text-[#4a443c] dark:text-[#a39b90] transition-colors hover:bg-[#d5cfc4] dark:hover:bg-[#2a2520]"
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
