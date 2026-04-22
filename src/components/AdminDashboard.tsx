"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CATEGORIES, MODELS } from "@/lib/constants";
import { createClient as createBrowserClient } from "@/lib/supabase-browser";
import type { ImagePrompt } from "@/lib/types";

interface AdminDashboardProps {
  email?: string | null;
}

const normalizeImageUrlInput = (raw: string) => {
  const trimmed = raw.trim();
  const markdownMatch = trimmed.match(/^!\[[^\]]*]\((.+?)\)$/);
  return markdownMatch ? markdownMatch[1].trim() : trimmed;
};

export default function AdminDashboard({ email }: AdminDashboardProps) {
  const router = useRouter();
  const [images, setImages] = useState<ImagePrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingImage, setEditingImage] = useState<ImagePrompt | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  // Form state
  const [formUrl, setFormUrl] = useState("");
  const [previewError, setPreviewError] = useState(false);
  const [formPrompt, setFormPrompt] = useState("");
  const [formAuthor, setFormAuthor] = useState("");
  const [formModel, setFormModel] = useState("");
  const [formCategory, setFormCategory] = useState("portrait");
  const [formTags, setFormTags] = useState("");
  const [formWidth, setFormWidth] = useState("");
  const [formHeight, setFormHeight] = useState("");
  const [formTweetUrl, setFormTweetUrl] = useState("");
  const [formPromptZh, setFormPromptZh] = useState("");
  const [formPromptJa, setFormPromptJa] = useState("");

  const fetchImagesFromApi = useCallback(async () => {
    const pageSize = 50;
    let offset = 0;
    let hasMore = true;
    const accumulated: ImagePrompt[] = [];

    while (hasMore) {
      const res = await fetch(`/api/images?limit=${pageSize}&offset=${offset}`, {
        cache: "no-store",
      });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load images");
      }

      const page: ImagePrompt[] = Array.isArray(json)
        ? json
        : Array.isArray(json.data)
          ? json.data
          : [];

      accumulated.push(...page);
      hasMore = Array.isArray(json) ? false : Boolean(json.hasMore);
      offset += page.length;

      if (page.length === 0) {
        hasMore = false;
      }
    }

    return accumulated;
  }, []);

  const fetchImagesFromBrowser = useCallback(async () => {
    const supabase = createBrowserClient();
    const pageSize = 100;
    let offset = 0;
    let hasMore = true;
    const accumulated: ImagePrompt[] = [];

    while (hasMore) {
      const { data, error } = await supabase
        .from("images")
        .select("*")
        .order("created_at", { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (error) {
        throw error;
      }

      const page = (data || []) as ImagePrompt[];
      accumulated.push(...page);
      hasMore = page.length === pageSize;
      offset += page.length;
    }

    return accumulated;
  }, []);

  const fetchImages = useCallback(async () => {
    setLoading(true);
    setMessage("");

    try {
      const nextImages = await fetchImagesFromBrowser();
      setImages(nextImages);
    } catch {
      try {
        const nextImages = await fetchImagesFromApi();
        setImages(nextImages);
      } catch {
        setImages([]);
        setMessage("Error: Unable to load images");
      }
    } finally {
      setLoading(false);
    }
  }, [fetchImagesFromApi, fetchImagesFromBrowser]);

  useEffect(() => {
    void fetchImages();
  }, [fetchImages]);

  const resetForm = () => {
    setFormUrl("");
    setPreviewError(false);
    setFormPrompt("");
    setFormAuthor("");
    setFormModel("");
    setFormCategory("portrait");
    setFormTags("");
    setFormWidth("");
    setFormHeight("");
    setFormTweetUrl("");
    setFormPromptZh("");
    setFormPromptJa("");
    setEditingImage(null);
    setShowForm(false);
    setMessage("");
  };

  const openAddForm = () => {
    resetForm();
    setShowForm(true);
  };

  const openEditForm = (image: ImagePrompt) => {
    setPreviewError(false);
    setEditingImage(image);
    setFormUrl(normalizeImageUrlInput(image.url));
    setFormPrompt(image.prompt || "");
    setFormAuthor(image.author);
    setFormModel(image.model);
    setFormCategory(image.category);
    setFormTags((image.tags || []).join(", "));
    setFormWidth(String(image.width || ""));
    setFormHeight(String(image.height || ""));
    setFormTweetUrl(image.tweet_url || "");
    setFormPromptZh(image.prompt_zh || "");
    setFormPromptJa(image.prompt_ja || "");
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");
    const normalizedUrl = normalizeImageUrlInput(formUrl);

    const payload = {
      url: normalizedUrl,
      prompt: formPrompt,
      author: formAuthor,
      model: formModel,
      category: formCategory,
      tags: formTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      width: formWidth ? parseInt(formWidth, 10) : null,
      height: formHeight ? parseInt(formHeight, 10) : null,
      tweet_url: formTweetUrl || null,
      prompt_zh: formPromptZh || null,
      prompt_ja: formPromptJa || null,
    };

    if (editingImage) {
      const res = await fetch(`/api/images/${editingImage.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setMessage("Updated successfully");
        await fetchImages();
        setTimeout(resetForm, 1000);
      } else {
        const err = await res.json();
        setMessage(`Error: ${err.error || "Update failed"}`);
      }
    } else {
      const res = await fetch("/api/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setMessage("Added successfully");
        await fetchImages();
        resetForm();
      } else {
        const err = await res.json();
        setMessage(`Error: ${err.error || "Add failed"}`);
      }
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this image?")) return;
    const res = await fetch(`/api/images/${id}`, { method: "DELETE" });
    if (res.ok) {
      await fetchImages();
      if (editingImage?.id === id) resetForm();
    }
  };

  const handleLogout = async () => {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-40 border-b border-zinc-200 dark:border-white/5 bg-zinc-50/80 dark:bg-zinc-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/")}
              className="text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              &larr; Back to site
            </button>
            <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800" />
            <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Admin</h1>
            <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500 dark:text-zinc-400">
              {images.length} images
            </span>
            {email && (
              <span className="hidden rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500 dark:text-zinc-400 sm:inline">
                {email}
              </span>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="rounded-lg px-3 py-1.5 text-xs text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-6 py-6">
        {!showForm && (
          <button
            onClick={openAddForm}
            className="mb-6 flex items-center gap-2 rounded-xl bg-zinc-900 dark:bg-white px-4 py-2.5 text-sm font-semibold text-white dark:text-zinc-900 transition-colors hover:bg-zinc-700 dark:hover:bg-zinc-200"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add New Image
          </button>
        )}

        {showForm && (
          <div className="mb-8 rounded-2xl bg-white dark:bg-zinc-900 p-6 ring-1 ring-zinc-200 dark:ring-white/10">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                {editingImage ? "Edit Image" : "Add New Image"}
              </h2>
              <button
                onClick={resetForm}
                className="rounded p-1 text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {message && (
              <div className={`mb-4 rounded-lg px-3 py-2 text-xs ring-1 ${
                message.startsWith("Error")
                  ? "bg-red-500/10 text-red-500 dark:text-red-400 ring-red-500/20"
                  : "bg-green-500/10 text-green-600 dark:text-green-400 ring-green-500/20"
              }`}>
                {message}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                    Image URL *
                  </label>
                  <input
                    type="text"
                    required
                    value={formUrl}
                    onChange={(e) => {
                      setFormUrl(normalizeImageUrlInput(e.target.value));
                      setPreviewError(false);
                    }}
                    placeholder="https://... or paste markdown ![](url)"
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                    Author
                  </label>
                  <input
                    type="text"
                    value={formAuthor}
                    onChange={(e) => setFormAuthor(e.target.value)}
                    placeholder="BubbleBrain"
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                    Model
                  </label>
                  <select
                    value={formModel}
                    onChange={(e) => setFormModel(e.target.value)}
                    required
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
                  >
                    <option value="" disabled>Select a model</option>
                    {MODELS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                    Category
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
                  >
                    {CATEGORIES.filter((c) => c.slug !== "all").map((c) => (
                      <option key={c.slug} value={c.slug}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  placeholder="portrait, cinematic, film"
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  Prompt *
                </label>
                <textarea
                  required
                  value={formPrompt}
                  onChange={(e) => setFormPrompt(e.target.value)}
                  placeholder="Describe the prompt for this image... (plain text or JSON)"
                  rows={6}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
                />
                <p className="mt-1 text-[10px] text-zinc-400 dark:text-zinc-600">
                  Supports plain text or JSON format
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  Prompt (中文)
                </label>
                <textarea
                  value={formPromptZh}
                  onChange={(e) => setFormPromptZh(e.target.value)}
                  placeholder="中文翻译（可选）"
                  rows={4}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  Prompt (日本語)
                </label>
                <textarea
                  value={formPromptJa}
                  onChange={(e) => setFormPromptJa(e.target.value)}
                  placeholder="日本語翻訳（オプション）"
                  rows={4}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                    Width (optional)
                  </label>
                  <input
                    type="number"
                    value={formWidth}
                    onChange={(e) => setFormWidth(e.target.value)}
                    placeholder="768"
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                    Height (optional)
                  </label>
                  <input
                    type="number"
                    value={formHeight}
                    onChange={(e) => setFormHeight(e.target.value)}
                    placeholder="1024"
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  Tweet URL (optional)
                </label>
                <input
                  type="text"
                  value={formTweetUrl}
                  onChange={(e) => setFormTweetUrl(e.target.value)}
                  placeholder="https://x.com/author/status/123..."
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
                />
                <p className="mt-1 text-[10px] text-zinc-400 dark:text-zinc-600">
                  If provided, clicking the author link will go to this tweet instead of their profile
                </p>
              </div>

              {formUrl && (
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                    Preview
                  </label>
                  <div className="flex h-48 items-center justify-center overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800 ring-1 ring-zinc-200 dark:ring-white/5">
                    {previewError ? (
                      <p className="text-xs text-red-400 dark:text-red-500 px-4 text-center">
                        Image failed to load — check if the URL is accessible
                      </p>
                    ) : (
                      <Image
                        src={formUrl}
                        alt="Preview"
                        width={400}
                        height={300}
                        className="h-full w-auto object-contain"
                        onLoad={() => setPreviewError(false)}
                        onError={() => setPreviewError(true)}
                      />
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 rounded-xl bg-zinc-900 dark:bg-white px-5 py-2.5 text-sm font-semibold text-white dark:text-zinc-900 transition-colors hover:bg-zinc-700 dark:hover:bg-zinc-200 disabled:opacity-50"
                >
                  {submitting
                    ? "Saving..."
                    : editingImage
                      ? "Update Image"
                      : "Add Image"}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-xl bg-zinc-100 dark:bg-zinc-800 px-4 py-2.5 text-sm text-zinc-500 dark:text-zinc-400 ring-1 ring-zinc-200 dark:ring-white/5 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-200"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-zinc-400 dark:text-zinc-500">Loading...</p>
        ) : images.length === 0 ? (
          <div className="rounded-2xl bg-white dark:bg-zinc-900 p-12 text-center ring-1 ring-zinc-200 dark:ring-white/5">
            <p className="text-sm text-zinc-400 dark:text-zinc-500">No images yet</p>
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-600">
              Click &ldquo;Add New Image&rdquo; to get started
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {images.map((image) => {
              let prompt;
              try {
                prompt = image.prompt ? JSON.parse(image.prompt) : null;
              } catch {
                prompt = null;
              }
              const desc = prompt?.image_description;
              const label =
                desc?.scene?.location?.city ||
                desc?.scene?.setting ||
                image.category;

              return (
                <div
                  key={image.id}
                  className="flex items-center gap-4 rounded-xl bg-white dark:bg-zinc-900 p-3 ring-1 ring-zinc-200 dark:ring-white/5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/80"
                >
                  <div className="h-16 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
                    <Image
                      src={image.url}
                      alt=""
                      width={48}
                      height={64}
                      sizes="48px"
                      unoptimized
                      className="h-full w-full object-cover"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-700 dark:text-zinc-200">
                      {label}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-zinc-400 dark:text-zinc-500">
                      <span>{image.author || "Unknown"}</span>
                      <span className="text-zinc-300 dark:text-zinc-700">|</span>
                      <span>{image.model}</span>
                      <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px]">
                        {image.category}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-shrink-0 items-center gap-1">
                    <button
                      onClick={() => openEditForm(image)}
                      className="rounded-lg p-2 text-zinc-400 dark:text-zinc-500 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-600 dark:hover:text-zinc-200"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(image.id)}
                      className="rounded-lg p-2 text-zinc-400 dark:text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-400"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
