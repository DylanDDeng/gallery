"use client";

import { useState, useRef, useEffect } from "react";
import { useAppStore } from "@/store";
import { createClient } from "@/lib/supabase-browser";

export default function UserMenu() {
  const user = useAppStore((s) => s.user);
  const favorites = useAppStore((s) => s.favorites);
  const showFavoritesOnly = useAppStore((s) => s.showFavoritesOnly);
  const toggleShowFavoritesOnly = useAppStore((s) => s.toggleShowFavoritesOnly);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const avatarUrl =
    user?.user_metadata?.avatar_url ||
    user?.user_metadata?.picture;
  const displayName =
    user?.user_metadata?.name ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "User";

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSignIn = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    useAppStore.setState({ favorites: [], favoritesLoaded: false });
    setOpen(false);
  };

  if (!user) {
    return (
      <button
        onClick={handleSignIn}
        className="flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-zinc-600 dark:text-zinc-300 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
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
        Sign in
      </button>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden transition-colors hover:bg-zinc-300 dark:hover:bg-zinc-600"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-200">
            {displayName.charAt(0).toUpperCase()}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-700">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
              {displayName}
            </p>
            {user.email && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                {user.email}
              </p>
            )}
          </div>
          <button
            onClick={() => {
              toggleShowFavoritesOnly();
              setOpen(false);
            }}
            className={`flex w-full items-center gap-2.5 text-left px-4 py-2.5 text-sm transition-colors ${
              showFavoritesOnly
                ? "text-red-500 bg-red-500/5"
                : "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700/50"
            }`}
          >
            <svg className="h-4 w-4" fill={showFavoritesOnly ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            Favorites
            {favorites.length > 0 && (
              <span className="ml-auto rounded bg-zinc-200 dark:bg-zinc-700 px-1.5 py-0.5 text-[10px]">
                {favorites.length}
              </span>
            )}
          </button>
          <button
            onClick={handleSignOut}
            className="w-full text-left px-4 py-2.5 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
