"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store";

export default function SettingsPage() {
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);

  useEffect(() => {
    if (!user) {
      const timer = setTimeout(() => {
        const currentUser = useAppStore.getState().user;
        if (!currentUser) {
          router.push("/");
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [router, user]);

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#f5f2ed] dark:bg-[#0c0b09]">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[#d5cfc4] dark:border-[#f5f2ed]/5 bg-[#f5f2ed]/80 dark:bg-[#0c0b09]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/")}
              className="text-xs text-[#8a837a] dark:text-[#5c564e] hover:text-[#4a443c] dark:hover:text-[#a39b90]"
            >
              &larr; Back to site
            </button>
            <div className="h-4 w-px bg-[#d5cfc4] dark:bg-[#1a1814]" />
            <h1 className="text-lg font-bold text-[#141210] dark:text-[#e0d9ce]">Settings</h1>
          </div>
          <button
            onClick={toggleTheme}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[#5c564e] transition-colors hover:bg-[#e0d9ce] dark:hover:bg-[#1a1814] hover:text-[#2a2520] dark:hover:text-[#a39b90]"
          >
            {theme === "light" ? (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            )}
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-[800px] px-6 py-8">
        {/* Appearance Section */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-[#141210] dark:text-[#e0d9ce] mb-2">
            Appearance
          </h2>
          <p className="text-sm text-[#5c564e] dark:text-[#8a837a] mb-6">
            Customize how the application looks on your device.
          </p>

          <div className="rounded-2xl bg-[#ebe7e0] dark:bg-[#141210] p-6 ring-1 ring-[#d5cfc4] dark:ring-[#c4bdb4]/10">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-[#141210] dark:text-[#e0d9ce]">Theme</h3>
                <p className="text-xs text-[#5c564e] dark:text-[#8a837a] mt-1">
                  Switch between light and dark mode
                </p>
              </div>
              <button
                onClick={toggleTheme}
                className="flex items-center gap-2 rounded-lg bg-[#f5f2ed] dark:bg-[#1a1814] px-4 py-2 text-sm font-medium text-[#2a2520] dark:text-[#a39b90] ring-1 ring-[#d5cfc4] dark:ring-[#2a2520] hover:bg-[#ebe7e0] dark:hover:bg-[#2a2520] transition-colors"
              >
                {theme === "light" ? (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    Light
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                    Dark
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Account Section */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-[#141210] dark:text-[#e0d9ce] mb-2">
            Account
          </h2>
          <p className="text-sm text-[#5c564e] dark:text-[#8a837a] mb-6">
            Manage your account information.
          </p>

          <div className="rounded-2xl bg-[#ebe7e0] dark:bg-[#141210] p-6 ring-1 ring-[#d5cfc4] dark:ring-[#c4bdb4]/10">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[#d5cfc4] dark:bg-[#1a1814] flex items-center justify-center">
                <span className="text-sm font-medium text-[#4a443c] dark:text-[#8a837a]">
                  {user.email?.charAt(0).toUpperCase() || "U"}
                </span>
              </div>
              <div>
                <p className="font-medium text-[#141210] dark:text-[#e0d9ce]">{user.email}</p>
                <p className="text-xs text-[#5c564e] dark:text-[#8a837a]">Signed in</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
