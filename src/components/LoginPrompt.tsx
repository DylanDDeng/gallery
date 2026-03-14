"use client";

import { useAppStore } from "@/store";
import { createClient } from "@/lib/supabase-browser";

export default function LoginPrompt() {
  const showLoginPrompt = useAppStore((s) => s.showLoginPrompt);
  const setShowLoginPrompt = useAppStore((s) => s.setShowLoginPrompt);

  if (!showLoginPrompt) return null;

  const handleSignIn = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setShowLoginPrompt(false)}
      />
      <div className="relative w-full max-w-sm mx-4 rounded-2xl bg-white dark:bg-zinc-900 p-6 shadow-2xl border border-zinc-200 dark:border-zinc-700">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Sign in to save favorites
        </h3>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Create an account or sign in with Google to keep your favorites saved across sessions.
        </p>
        <button
          onClick={handleSignIn}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors shadow-sm"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Continue with Google
        </button>
        <button
          onClick={() => setShowLoginPrompt(false)}
          className="mt-2 w-full py-2 text-xs text-zinc-400 hover:text-zinc-500 dark:hover:text-zinc-300 transition-colors"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}
