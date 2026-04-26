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
    <div className="min-h-screen bg-[#ebe7e0] dark:bg-[#0c0b09]">
      <header className="sticky top-0 z-40 border-b border-[#d5cfc4] dark:border-[#f5f2ed]/5 bg-[#ebe7e0]/80 dark:bg-[#0c0b09]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/")}
              className="text-xs text-[#8a837a] dark:text-[#5c564e] hover:text-[#4a443c] dark:hover:text-[#a39b90]"
            >
              &larr; Back to site
            </button>
            <div className="h-4 w-px bg-[#d5cfc4] dark:bg-[#1a1814]" />
            <h1 className="text-lg font-bold text-[#141210] dark:text-[#e0d9ce]">Admin</h1>
            <span className="rounded bg-[#e0d9ce] dark:bg-[#1a1814] px-2 py-0.5 text-[10px] text-[#5c564e] dark:text-[#8a837a]">
              {images.length} images
            </span>
            {email && (
              <span className="hidden rounded bg-[#e0d9ce] dark:bg-[#1a1814] px-2 py-0.5 text-[10px] text-[#5c564e] dark:text-[#8a837a] sm:inline">
                {email}
              </span>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="rounded-lg px-3 py-1.5 text-xs text-[#8a837a] dark:text-[#5c564e] hover:bg-[#e0d9ce] dark:hover:bg-[#1a1814] hover:text-[#4a443c] dark:hover:text-[#a39b90]"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-6 py-6">
        {!showForm && (
          <button
            onClick={openAddForm}
            className="mb-6 flex items-center gap-2 rounded-xl bg-[#141210] dark:bg-[#f5f2ed] px-4 py-2.5 text-sm font-semibold text-[#f5f2ed] dark:text-[#141210] transition-colors hover:bg-[#2a2520] dark:hover:bg-[#d5cfc4]"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add New Image
          </button>
        )}

        {showForm && (
          <div className="mb-8 rounded-2xl bg-[#f5f2ed] dark:bg-[#141210] p-6 ring-1 ring-[#d5cfc4] dark:ring-[#c4bdb4]/10">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#141210] dark:text-[#e0d9ce]">
                {editingImage ? "Edit Image" : "Add New Image"}
              </h2>
              <button
                onClick={resetForm}
                className="rounded p-1 text-[#8a837a] dark:text-[#5c564e] hover:bg-[#e0d9ce] dark:hover:bg-[#1a1814] hover:text-[#4a443c] dark:hover:text-[#a39b90]"
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
                  <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-[#8a837a] dark:text-[#5c564e]">
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
                    className="w-full rounded-lg border border-[#d5cfc4] dark:border-[#2a2520] bg-[#ebe7e0] dark:bg-[#1a1814] px-3 py-2 text-sm text-[#141210] dark:text-[#e0d9ce] placeholder-[#8a837a] dark:placeholder-[#4a443c] outline-none focus:border-[#8a837a] dark:focus:border-[#5c564e]"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-[#8a837a] dark:text-[#5c564e]">
                    Author
                  </label>
                  <input
                    type="text"
                    value={formAuthor}
                    onChange={(e) => setFormAuthor(e.target.value)}
                    placeholder="BubbleBrain"
                    className="w-full rounded-lg border border-[#d5cfc4] dark:border-[#2a2520] bg-[#ebe7e0] dark:bg-[#1a1814] px-3 py-2 text-sm text-[#141210] dark:text-[#e0d9ce] placeholder-[#8a837a] dark:placeholder-[#4a443c] outline-none focus:border-[#8a837a] dark:focus:border-[#5c564e]"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-[#8a837a] dark:text-[#5c564e]">
                    Model
                  </label>
                  <select
                    value={formModel}
                    onChange={(e) => setFormModel(e.target.value)}
                    required
                    className="w-full rounded-lg border border-[#d5cfc4] dark:border-[#2a2520] bg-[#ebe7e0] dark:bg-[#1a1814] px-3 py-2 text-sm text-[#141210] dark:text-[#e0d9ce] outline-none focus:border-[#8a837a] dark:focus:border-[#5c564e]"
                  >
                    <option value="" disabled>Select a model</option>
                    {MODELS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-[#8a837a] dark:text-[#5c564e]">
                    Category
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full rounded-lg border border-[#d5cfc4] dark:border-[#2a2520] bg-[#ebe7e0] dark:bg-[#1a1814] px-3 py-2 text-sm text-[#141210] dark:text-[#e0d9ce] outline-none focus:border-[#8a837a] dark:focus:border-[#5c564e]"
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
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-[#8a837a] dark:text-[#5c564e]">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  placeholder="portrait, cinematic, film"
                  className="w-full rounded-lg border border-[#d5cfc4] dark:border-[#2a2520] bg-[#ebe7e0] dark:bg-[#1a1814] px-3 py-2 text-sm text-[#141210] dark:text-[#e0d9ce] placeholder-[#8a837a] dark:placeholder-[#4a443c] outline-none focus:border-[#8a837a] dark:focus:border-[#5c564e]"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-[#8a837a] dark:text-[#5c564e]">
                  Prompt *
                </label>
                <textarea
                  required
                  value={formPrompt}
                  onChange={(e) => setFormPrompt(e.target.value)}
                  placeholder="Describe the prompt for this image... (plain text or JSON)"
                  rows={6}
                  className="w-full rounded-lg border border-[#d5cfc4] dark:border-[#2a2520] bg-[#ebe7e0] dark:bg-[#1a1814] px-3 py-2 text-sm text-[#141210] dark:text-[#e0d9ce] placeholder-[#8a837a] dark:placeholder-[#4a443c] outline-none focus:border-[#8a837a] dark:focus:border-[#5c564e]"
                />
                <p className="mt-1 text-[10px] text-[#8a837a] dark:text-[#4a443c]">
                  Supports plain text or JSON format
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-[#8a837a] dark:text-[#5c564e]">
                  Prompt (中文)
                </label>
                <textarea
                  value={formPromptZh}
                  onChange={(e) => setFormPromptZh(e.target.value)}
                  placeholder="中文翻译（可选）"
                  rows={4}
                  className="w-full rounded-lg border border-[#d5cfc4] dark:border-[#2a2520] bg-[#ebe7e0] dark:bg-[#1a1814] px-3 py-2 text-sm text-[#141210] dark:text-[#e0d9ce] placeholder-[#8a837a] dark:placeholder-[#4a443c] outline-none focus:border-[#8a837a] dark:focus:border-[#5c564e]"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-[#8a837a] dark:text-[#5c564e]">
                  Prompt (日本語)
                </label>
                <textarea
                  value={formPromptJa}
                  onChange={(e) => setFormPromptJa(e.target.value)}
                  placeholder="日本語翻訳（オプション）"
                  rows={4}
                  className="w-full rounded-lg border border-[#d5cfc4] dark:border-[#2a2520] bg-[#ebe7e0] dark:bg-[#1a1814] px-3 py-2 text-sm text-[#141210] dark:text-[#e0d9ce] placeholder-[#8a837a] dark:placeholder-[#4a443c] outline-none focus:border-[#8a837a] dark:focus:border-[#5c564e]"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-[#8a837a] dark:text-[#5c564e]">
                    Width (optional)
                  </label>
                  <input
                    type="number"
                    value={formWidth}
                    onChange={(e) => setFormWidth(e.target.value)}
                    placeholder="768"
                    className="w-full rounded-lg border border-[#d5cfc4] dark:border-[#2a2520] bg-[#ebe7e0] dark:bg-[#1a1814] px-3 py-2 text-sm text-[#141210] dark:text-[#e0d9ce] placeholder-[#8a837a] dark:placeholder-[#4a443c] outline-none focus:border-[#8a837a] dark:focus:border-[#5c564e]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-[#8a837a] dark:text-[#5c564e]">
                    Height (optional)
                  </label>
                  <input
                    type="number"
                    value={formHeight}
                    onChange={(e) => setFormHeight(e.target.value)}
                    placeholder="1024"
                    className="w-full rounded-lg border border-[#d5cfc4] dark:border-[#2a2520] bg-[#ebe7e0] dark:bg-[#1a1814] px-3 py-2 text-sm text-[#141210] dark:text-[#e0d9ce] placeholder-[#8a837a] dark:placeholder-[#4a443c] outline-none focus:border-[#8a837a] dark:focus:border-[#5c564e]"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-[#8a837a] dark:text-[#5c564e]">
                  Tweet URL (optional)
                </label>
                <input
                  type="text"
                  value={formTweetUrl}
                  onChange={(e) => setFormTweetUrl(e.target.value)}
                  placeholder="https://x.com/author/status/123..."
                  className="w-full rounded-lg border border-[#d5cfc4] dark:border-[#2a2520] bg-[#ebe7e0] dark:bg-[#1a1814] px-3 py-2 text-sm text-[#141210] dark:text-[#e0d9ce] placeholder-[#8a837a] dark:placeholder-[#4a443c] outline-none focus:border-[#8a837a] dark:focus:border-[#5c564e]"
                />
                <p className="mt-1 text-[10px] text-[#8a837a] dark:text-[#4a443c]">
                  If provided, clicking the author link will go to this tweet instead of their profile
                </p>
              </div>

              {formUrl && (
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-[#8a837a] dark:text-[#5c564e]">
                    Preview
                  </label>
                  <div className="flex h-48 items-center justify-center overflow-hidden rounded-lg bg-[#e0d9ce] dark:bg-[#1a1814] ring-1 ring-[#d5cfc4] dark:ring-white/5">
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
                  className="flex items-center gap-2 rounded-xl bg-[#141210] dark:bg-[#f5f2ed] px-5 py-2.5 text-sm font-semibold text-[#f5f2ed] dark:text-[#141210] transition-colors hover:bg-[#2a2520] dark:hover:bg-[#d5cfc4] disabled:opacity-50"
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
                  className="rounded-xl bg-[#e0d9ce] dark:bg-[#1a1814] px-4 py-2.5 text-sm text-[#5c564e] dark:text-[#8a837a] ring-1 ring-[#d5cfc4] dark:ring-white/5 hover:bg-[#d5cfc4] dark:hover:bg-[#2a2520] hover:text-[#2a2520] dark:hover:text-[#d5cfc4]"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-[#8a837a] dark:text-[#5c564e]">Loading...</p>
        ) : images.length === 0 ? (
          <div className="rounded-2xl bg-[#f5f2ed] dark:bg-[#141210] p-12 text-center ring-1 ring-[#d5cfc4] dark:ring-white/5">
            <p className="text-sm text-[#8a837a] dark:text-[#5c564e]">No images yet</p>
            <p className="mt-1 text-xs text-[#8a837a] dark:text-[#4a443c]">
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
                  className="flex items-center gap-4 rounded-xl bg-[#f5f2ed] dark:bg-[#141210] p-3 ring-1 ring-[#d5cfc4] dark:ring-white/5 transition-colors hover:bg-[#ebe7e0] dark:hover:bg-[#1a1814]/80"
                >
                  <div className="h-16 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-[#e0d9ce] dark:bg-[#1a1814]">
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
                    <p className="truncate text-sm font-medium text-[#2a2520] dark:text-[#d5cfc4]">
                      {label}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[#8a837a] dark:text-[#5c564e]">
                      <span>{image.author || "Unknown"}</span>
                      <span className="text-[#a39b90] dark:text-[#2a2520]">|</span>
                      <span>{image.model}</span>
                      <span className="rounded bg-[#e0d9ce] dark:bg-[#1a1814] px-1.5 py-0.5 text-[10px]">
                        {image.category}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-shrink-0 items-center gap-1">
                    <button
                      onClick={() => openEditForm(image)}
                      className="rounded-lg p-2 text-[#8a837a] dark:text-[#5c564e] transition-colors hover:bg-[#e0d9ce] dark:hover:bg-[#2a2520] hover:text-[#4a443c] dark:hover:text-[#d5cfc4]"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(image.id)}
                      className="rounded-lg p-2 text-[#8a837a] dark:text-[#5c564e] transition-colors hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-400"
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
