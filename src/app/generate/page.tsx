"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { isBillingEnabled } from "@/lib/billing-feature";
import { useAppStore } from "@/store";

interface GenerationTask {
  id: string;
  prompt: string;
  model: string;
  status: "queued" | "processing" | "completed" | "failed" | "cancelled";
  result_url?: string;
  error_message?: string;
  credits_cost?: number;
  created_at: string;
}

export default function GeneratePage() {
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const billingEnabled = isBillingEnabled();

  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [currentTask, setCurrentTask] = useState<GenerationTask | null>(null);
  const [recentTasks, setRecentTasks] = useState<GenerationTask[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [credits, setCredits] = useState<number | null>(null);

  const fetchCredits = useCallback(async () => {
    try {
      const res = await fetch("/api/credits");
      const json = await res.json();
      if (res.ok) {
        setCredits(json.credits);
      }
    } catch (error) {
      console.error("Error fetching credits:", error);
    }
  }, []);

  // Check if user has API key configured
  const checkApiKey = useCallback(async () => {
    try {
      const res = await fetch("/api/user/api-keys");
      const json = await res.json();
      if (res.ok) {
        const hasDoubao = json.data?.some((k: { provider: string }) => k.provider === "doubao");
        setHasApiKey(hasDoubao || false);
      }
    } catch (error) {
      console.error("Error checking API key:", error);
      setHasApiKey(false);
    }
  }, []);

  // Fetch recent tasks
  const fetchRecentTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/generations?limit=5");
      const json = await res.json();
      if (res.ok) {
        setRecentTasks(json.data || []);
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      router.push("/");
      return;
    }
    void checkApiKey();
    if (billingEnabled) {
      void fetchCredits();
    }
    void fetchRecentTasks();
  }, [billingEnabled, user, router, checkApiKey, fetchCredits, fetchRecentTasks]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || submitting) return;

    setSubmitting(true);
    setError(null);
    setCurrentTask(null);

    try {
      const res = await fetch("/api/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "Failed to create generation");
        if (json.error?.includes("API key")) {
          setHasApiKey(false);
        }
        void fetchRecentTasks();
        if (billingEnabled) {
          void fetchCredits();
        }
        return;
      }

      setCurrentTask(json.task);
      setPrompt("");
      if (billingEnabled) {
        void fetchCredits();
      }

      // Refresh recent tasks
      void fetchRecentTasks();
    } catch (err) {
      console.error("Error creating generation:", err);
      setError("An error occurred. Please try again.");
      if (billingEnabled) {
        void fetchCredits();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownload = (url: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = `generated-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!user) {
    return null;
  }

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
            <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Generate</h1>
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
        {/* API Key Warning */}
        {hasApiKey === false && (
          <div className="mb-6 rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-600 dark:text-amber-400">
            <p className="font-medium">API Key not configured</p>
            <p className="mt-1">Please configure your Doubao API key in{" "}
              <button
                onClick={() => router.push("/settings")}
                className="underline hover:no-underline"
              >
                Settings
              </button>
              {" "}to start generating images.
            </p>
          </div>
        )}

        {billingEnabled ? (
          <div className="mb-6 flex items-center justify-between rounded-2xl bg-zinc-50 px-5 py-4 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-white/10">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">
                Credits
              </p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                {credits ?? "—"}
              </p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Each generation costs 1 credit.
              </p>
            </div>
            <button
              onClick={() => router.push("/credits")}
              className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              Buy Credits
            </button>
          </div>
        ) : (
          <div className="mb-6 rounded-2xl bg-zinc-50 px-5 py-4 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-white/10">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">
              API-key mode
            </p>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              Generation currently uses your own configured Doubao API key. Credits and purchases are disabled.
            </p>
          </div>
        )}

        {/* Generate Form */}
        <form onSubmit={(e) => void handleSubmit(e)} className="mb-8">
          <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-900 p-6 ring-1 ring-zinc-200 dark:ring-white/10">
            <label className="mb-2 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the image you want to generate..."
              rows={4}
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-3 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none focus:border-zinc-400 dark:focus:border-zinc-500 resize-none"
            />

            {error && (
              <div className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500 dark:text-red-400">
                {error}
              </div>
            )}

            <div className="mt-4 flex items-center justify-end">
              <button
                type="submit"
                disabled={
                  submitting ||
                  !prompt.trim() ||
                  !hasApiKey ||
                  (billingEnabled && (credits ?? 0) < 1)
                }
                className="flex items-center gap-2 rounded-xl bg-zinc-900 dark:bg-white px-6 py-2.5 text-sm font-semibold text-white dark:text-zinc-900 transition-colors hover:bg-zinc-700 dark:hover:bg-zinc-200 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white dark:border-zinc-900/30 dark:border-t-zinc-900" />
                    Generating...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Generate
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Current Task */}
        {currentTask && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">Current Generation</h2>
            <div className="rounded-2xl bg-white dark:bg-zinc-900 p-4 ring-1 ring-zinc-200 dark:ring-white/10">
              <div className="flex items-start gap-4">
                {currentTask.status === "completed" && currentTask.result_url ? (
                  <div className="relative group">
                    <img
                      src={currentTask.result_url}
                      alt="Generated"
                      className="h-32 w-32 rounded-lg object-cover"
                    />
                    <button
                      onClick={() => handleDownload(currentTask.result_url!)}
                      className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </button>
                  </div>
                ) : currentTask.status === "failed" ? (
                  <div className="h-32 w-32 rounded-lg bg-red-500/10 flex items-center justify-center">
                    <svg className="h-8 w-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                ) : (
                  <div className="h-32 w-32 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-200 dark:border-zinc-700 border-t-zinc-400" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      currentTask.status === "completed"
                        ? "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400"
                        : currentTask.status === "failed"
                        ? "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400"
                        : "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400"
                    }`}>
                      {currentTask.status === "processing" && "Processing"}
                      {currentTask.status === "completed" && "Completed"}
                      {currentTask.status === "failed" && "Failed"}
                    </span>
                    <span className="text-xs text-zinc-400 dark:text-zinc-500">
                      {new Date(currentTask.created_at).toLocaleTimeString()}
                    </span>
                    {billingEnabled && (currentTask.credits_cost ?? 0) > 0 && (
                      <span className="text-xs text-zinc-400 dark:text-zinc-500">
                        {currentTask.credits_cost ?? 1} credit
                        {(currentTask.credits_cost ?? 1) !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2 mb-1">
                    {currentTask.prompt}
                  </p>

                  {currentTask.status === "completed" && currentTask.result_url && (
                    <button
                      onClick={() => handleDownload(currentTask.result_url!)}
                      className="mt-2 flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download
                    </button>
                  )}

                  {currentTask.status === "failed" && currentTask.error_message && (
                    <p className="text-xs text-red-500 dark:text-red-400">
                      {currentTask.error_message}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Tasks */}
        {recentTasks.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Recent Generations</h2>
              <button
                onClick={() => router.push("/history")}
                className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                View all &rarr;
              </button>
            </div>
            <div className="space-y-3">
              {recentTasks.slice(0, 3).map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 p-3 ring-1 ring-zinc-200 dark:ring-white/10"
                >
                  {task.status === "completed" && task.result_url ? (
                    <div className="relative group flex-shrink-0">
                      <img
                        src={task.result_url}
                        alt=""
                        className="h-12 w-12 rounded-lg object-cover"
                      />
                      <button
                        onClick={() => handleDownload(task.result_url!)}
                        className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <div className="h-12 w-12 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
                      {task.status === "failed" ? (
                        <svg className="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      ) : (
                        <div className="h-4 w-4 animate-spin rounded-full border border-zinc-200 dark:border-zinc-700 border-t-zinc-400" />
                      )}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-700 dark:text-zinc-300 truncate">
                      {task.prompt}
                    </p>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500">
                      {new Date(task.created_at).toLocaleString()}
                    </p>
                    {billingEnabled && (task.credits_cost ?? 0) > 0 && (
                      <p className="text-xs text-zinc-400 dark:text-zinc-500">
                        {task.credits_cost ?? 1} credit
                        {(task.credits_cost ?? 1) !== 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
