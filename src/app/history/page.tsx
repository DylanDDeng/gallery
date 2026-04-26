"use client";

import Image from "next/image";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { isBillingEnabled } from "@/lib/billing-feature";
import { useAppStore } from "@/store";

interface Order {
  id: string;
  amount: number;
  price_cents: number;
  status: string;
  created_at: string;
}

interface GenerationTask {
  id: string;
  prompt: string;
  model: string;
  status: string;
  result_url?: string;
  error_message?: string;
  credits_cost: number;
  created_at: string;
}

type Tab = "generations" | "orders";

export default function HistoryPage() {
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const billingEnabled = isBillingEnabled();

  const [activeTab, setActiveTab] = useState<Tab>("generations");
  const [generations, setGenerations] = useState<GenerationTask[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchGenerations = useCallback(async () => {
    try {
      const res = await fetch("/api/generations?limit=50");
      const json = await res.json();
      if (res.ok) {
        setGenerations(json.data || []);
      }
    } catch (error) {
      console.error("Error fetching generations:", error);
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/orders");
      const json = await res.json();
      if (res.ok) {
        setOrders(json.orders || []);
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      router.push("/");
      return;
    }

    const load = async () => {
      setLoading(true);
      if (billingEnabled) {
        await Promise.all([fetchGenerations(), fetchOrders()]);
      } else {
        await fetchGenerations();
      }
      setLoading(false);
    };
    void load();
  }, [billingEnabled, user, router, fetchGenerations, fetchOrders]);

  const handleDelete = async (taskId: string) => {
    if (!confirm("Are you sure you want to delete this task from your history?")) {
      return;
    }

    setCancellingId(taskId);

    try {
      const res = await fetch(`/api/generations/${taskId}`, { method: "DELETE" });
      if (res.ok) {
        void fetchGenerations();
      } else {
        const json = await res.json();
        alert(json.error || "Failed to delete task");
      }
    } catch (error) {
      console.error("Error deleting task:", error);
      alert("An error occurred");
    } finally {
      setCancellingId(null);
    }
  };

  if (!user) {
    return null;
  }

  const statusStyles: Record<string, string> = {
    completed: "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400",
    failed: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400",
    cancelled: "bg-[#e0d9ce] text-[#5c564e] dark:bg-[#1a1814] dark:text-[#8a837a]",
    queued: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
    processing: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
    pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400",
    refunded: "bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400",
  };

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
            <h1 className="text-lg font-bold text-[#141210] dark:text-[#e0d9ce]">History</h1>
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
        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-xl bg-[#e0d9ce] dark:bg-[#141210] p-1">
          <button
            onClick={() => setActiveTab("generations")}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "generations"
                ? "bg-[#f5f2ed] dark:bg-[#1a1814] text-[#141210] dark:text-[#e0d9ce] shadow-sm"
                : "text-[#5c564e] dark:text-[#8a837a] hover:text-[#2a2520] dark:hover:text-[#d5cfc4]"
            }`}
          >
            Generations
          </button>
          {billingEnabled && (
            <button
              onClick={() => setActiveTab("orders")}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === "orders"
                  ? "bg-[#f5f2ed] dark:bg-[#1a1814] text-[#141210] dark:text-[#e0d9ce] shadow-sm"
                  : "text-[#5c564e] dark:text-[#8a837a] hover:text-[#2a2520] dark:hover:text-[#d5cfc4]"
              }`}
            >
              Orders
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#d5cfc4] dark:border-[#2a2520] border-t-[#8a837a]" />
          </div>
        ) : activeTab === "generations" ? (
          generations.length === 0 ? (
            <div className="rounded-2xl bg-[#ebe7e0] dark:bg-[#141210] p-12 text-center">
              <p className="text-sm text-[#8a837a] dark:text-[#5c564e]">No generations yet</p>
              <button
                onClick={() => router.push("/generate")}
                className="mt-3 text-sm font-medium text-[#4a443c] dark:text-[#8a837a] hover:text-[#141210] dark:hover:text-[#d5cfc4]"
              >
                Create your first generation &rarr;
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {generations.map((task) => (
                <div
                  key={task.id}
                  className="flex items-start gap-4 rounded-xl bg-[#ebe7e0] dark:bg-[#141210] p-4 ring-1 ring-[#d5cfc4] dark:ring-[#c4bdb4]/10"
                >
                  {task.status === "completed" && task.result_url ? (
                    <Image
                      src={task.result_url}
                      alt=""
                      width={80}
                      height={80}
                      className="h-20 w-20 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="h-20 w-20 rounded-lg bg-[#e0d9ce] dark:bg-[#1a1814] flex items-center justify-center flex-shrink-0">
                      {task.status === "failed" ? (
                        <svg className="h-6 w-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      ) : (
                        <div className="h-5 w-5 animate-spin rounded-full border border-[#d5cfc4] dark:border-[#2a2520] border-t-[#8a837a]" />
                      )}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusStyles[task.status] || ""}`}>
                        {task.status}
                      </span>
                      {billingEnabled && task.credits_cost > 0 && (
                        <span className="text-xs text-[#8a837a] dark:text-[#5c564e]">
                          {task.credits_cost} credit{task.credits_cost !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-[#2a2520] dark:text-[#a39b90] mb-1 line-clamp-2">
                      {task.prompt}
                    </p>

                    {task.error_message && (
                      <p className="text-xs text-red-500 dark:text-red-400 mb-1">
                        {task.error_message}
                      </p>
                    )}

                    <p className="text-xs text-[#8a837a] dark:text-[#5c564e]">
                      {new Date(task.created_at).toLocaleString()}
                    </p>
                  </div>

                  {(task.status === "completed" || task.status === "failed") && (
                    <button
                      onClick={() => void handleDelete(task.id)}
                      disabled={cancellingId === task.id}
                      className="flex-shrink-0 rounded-lg px-3 py-1.5 text-xs text-red-500 hover:bg-red-500/10 disabled:opacity-50"
                    >
                      {cancellingId === task.id ? "Deleting..." : "Delete"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )
        ) : !billingEnabled ? null : orders.length === 0 ? (
          <div className="rounded-2xl bg-[#ebe7e0] dark:bg-[#141210] p-12 text-center">
            <p className="text-sm text-[#8a837a] dark:text-[#5c564e]">No orders yet</p>
            <button
              onClick={() => router.push("/credits")}
              className="mt-3 text-sm font-medium text-[#4a443c] dark:text-[#8a837a] hover:text-[#141210] dark:hover:text-[#d5cfc4]"
            >
              Buy credits &rarr;
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between rounded-xl bg-[#ebe7e0] dark:bg-[#141210] p-4 ring-1 ring-[#d5cfc4] dark:ring-[#c4bdb4]/10"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusStyles[order.status] || ""}`}>
                      {order.status}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-[#2a2520] dark:text-[#a39b90]">
                    {order.amount.toLocaleString()} credits
                  </p>
                  <p className="text-xs text-[#8a837a] dark:text-[#5c564e]">
                    {new Date(order.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-[#141210] dark:text-[#e0d9ce]">
                    ${(order.price_cents / 100).toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
