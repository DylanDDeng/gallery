"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store";

interface ApiKeyConfig {
  id: string;
  provider: string;
  name: string | null;
  is_active: boolean;
  created_at: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);

  const [apiKeys, setApiKeys] = useState<ApiKeyConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [doubaoKey, setDoubaoKey] = useState("");
  const [doubaoKeyName, setDoubaoKeyName] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [testResult, setTestResult] = useState<{ status: "valid" | "invalid" | null; message: string }>({
    status: null,
    message: "",
  });

  const fetchApiKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/user/api-keys");
      const json = await res.json();
      if (res.ok) {
        setApiKeys(json.data || []);
        const doubaoEntry = json.data?.find((k: ApiKeyConfig) => k.provider === "doubao");
        if (doubaoEntry) {
          setDoubaoKeyName(doubaoEntry.name || "");
        }
      }
    } catch (error) {
      console.error("Error fetching API keys:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      // Only redirect to home if we're sure user is not logged in
      // Use a small delay to allow auth state to sync
      const timer = setTimeout(() => {
        const currentUser = useAppStore.getState().user;
        if (!currentUser) {
          router.push("/");
        }
      }, 100);
      return () => clearTimeout(timer);
    }
    void fetchApiKeys();
  }, [user, router, fetchApiKeys]);

  const handleSave = async () => {
    if (!doubaoKey.trim() && !apiKeys.find((k) => k.provider === "doubao")) {
      setMessage({ type: "error", text: "Please enter an API key" });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/user/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "doubao",
          apiKey: doubaoKey.trim(),
          name: doubaoKeyName.trim() || null,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setMessage({ type: "error", text: json.error || "Failed to save API key" });
        return;
      }

      setMessage({ type: "success", text: "API key saved successfully" });
      setDoubaoKey("");
      void fetchApiKeys();
    } catch (error) {
      console.error("Error saving API key:", error);
      setMessage({ type: "error", text: "An error occurred. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    const hasStoredKey = apiKeys.some(
      (key) => key.provider === "doubao" && key.is_active
    );

    if (!doubaoKey.trim() && !hasStoredKey) {
      setTestResult({ status: null, message: "No API key to test" });
      return;
    }

    setTesting("doubao");
    setTestResult({ status: null, message: "" });

    try {
      const res = await fetch("/api/user/api-keys/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "doubao",
          apiKey: doubaoKey.trim() || undefined,
        }),
      });

      const json = await res.json();

      if (res.ok && json.valid) {
        setTestResult({ status: "valid", message: "Connection successful!" });
      } else {
        setTestResult({ status: "invalid", message: json.error || "Invalid API key" });
      }
    } catch (error) {
      console.error("Error testing API key:", error);
      setTestResult({ status: "invalid", message: "Connection failed" });
    } finally {
      setTesting(null);
    }
  };

  const handleDelete = async (provider: string) => {
    try {
      const res = await fetch(`/api/user/api-keys?provider=${provider}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setMessage({ type: "success", text: `${provider} API key deleted` });
        void fetchApiKeys();
      }
    } catch (error) {
      console.error("Error deleting API key:", error);
    }
  };

  if (!user) {
    return null;
  }

  const hasDoubaoKey = apiKeys.some((k) => k.provider === "doubao" && k.is_active);

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-zinc-200 dark:border-white/5 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/")}
              className="text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              &larr; Back to site
            </button>
            <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800" />
            <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Settings</h1>
          </div>
          <button
            onClick={toggleTheme}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-300"
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
        {/* Message */}
        {message && (
          <div className={`mb-6 rounded-xl px-4 py-3 text-sm ${
            message.type === "success"
              ? "bg-green-500/10 text-green-600 dark:text-green-400"
              : "bg-red-500/10 text-red-500 dark:text-red-400"
          }`}>
            {message.text}
          </div>
        )}

        {/* API Keys Section */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
            API Configuration
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
            Configure your own API keys for image generation. Your keys are encrypted and stored securely.
          </p>

          {/* Doubao API Key */}
          <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-900 p-6 ring-1 ring-zinc-200 dark:ring-white/10 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-lg bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center">
                <svg className="h-4 w-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Doubao Seedream</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Image generation model</p>
              </div>
              {hasDoubaoKey && (
                <span className="ml-auto rounded-full bg-green-100 dark:bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
                  Configured
                </span>
              )}
            </div>

            {loading ? (
              <div className="space-y-3">
                <div className="h-10 bg-zinc-200 dark:bg-zinc-800 rounded-lg animate-pulse" />
                <div className="h-10 bg-zinc-200 dark:bg-zinc-800 rounded-lg animate-pulse" />
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      API Key
                    </label>
                    <div className="relative">
                      <input
                        type={showKey ? "text" : "password"}
                        value={doubaoKey}
                        onChange={(e) => setDoubaoKey(e.target.value)}
                        placeholder={hasDoubaoKey ? "Leave empty to keep existing key" : "Enter your Doubao API key"}
                        className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2.5 pr-10 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey(!showKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                      >
                        {showKey ? (
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        ) : (
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.543 7-1.275 4.057-5.064 7-9.543 7-4.477 0-8.268-2.943-9.543-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Key Name (optional)
                    </label>
                    <input
                      type="text"
                      value={doubaoKeyName}
                      onChange={(e) => setDoubaoKeyName(e.target.value)}
                      placeholder="e.g., My Doubao Key"
                      className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2.5 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
                    />
                  </div>

                  {/* Test Result */}
                  {testResult.status && (
                    <div className={`rounded-lg px-3 py-2 text-sm flex items-center gap-2 ${
                      testResult.status === "valid"
                        ? "bg-green-500/10 text-green-600 dark:text-green-400"
                        : "bg-red-500/10 text-red-500 dark:text-red-400"
                    }`}>
                      {testResult.status === "valid" ? (
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                      {testResult.message}
                    </div>
                  )}

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={() => void handleSave()}
                      disabled={saving || (!doubaoKey.trim() && !hasDoubaoKey)}
                      className="flex items-center gap-2 rounded-xl bg-zinc-900 dark:bg-white px-5 py-2.5 text-sm font-semibold text-white dark:text-zinc-900 transition-colors hover:bg-zinc-700 dark:hover:bg-zinc-200 disabled:opacity-50"
                    >
                      {saving ? (
                        <>
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white dark:border-zinc-900/30 dark:border-t-zinc-900" />
                          Saving...
                        </>
                      ) : (
                        "Save"
                      )}
                    </button>
                    <button
                      onClick={() => void handleTest()}
                      disabled={testing !== null || (!doubaoKey.trim() && !hasDoubaoKey)}
                      className="flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-700 px-5 py-2.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50"
                    >
                      {testing ? (
                        <>
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300/30 border-t-zinc-400 dark:border-zinc-600/30 dark:border-t-zinc-500" />
                          Testing...
                        </>
                      ) : (
                        "Test Connection"
                      )}
                    </button>
                    {hasDoubaoKey && (
                      <button
                        onClick={() => void handleDelete("doubao")}
                        className="ml-auto text-sm text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Info Card */}
          <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900 p-4 text-sm text-zinc-500 dark:text-zinc-400">
            <p className="mb-2 font-medium text-zinc-700 dark:text-zinc-300">Where to get API keys?</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>
                <a
                  href="https://console.volcengine.com/ark"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Doubao Seedream
                </a>
                {" "}- Volcano Engine Ark console
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
