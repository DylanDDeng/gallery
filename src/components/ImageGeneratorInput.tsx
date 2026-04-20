"use client";

import { useState, useRef, type FormEvent, type ChangeEvent } from "react";
import Image from "next/image";

interface ImageGeneratorInputProps {
  onSubmit: (prompt: string) => Promise<void>;
  onReferenceImageUpload?: (file: File) => Promise<void>;
  onClearReferenceImage?: () => void;
  referenceImageUrl?: string | null;
  submitting?: boolean;
  disabled?: boolean;
  credits?: number | null;
  showCredits?: boolean;
  error?: string | null;
}

const MODELS = [
  { id: "doubao-seedream-5-0-260128", name: "Nano Banana 2" },
  { id: "doubao-seedream-4-0", name: "Seedream 4.0" },
] as const;

const RESOLUTIONS = [
  { id: "1K", label: "1K" },
  { id: "2K", label: "2K" },
] as const;

const ASPECT_RATIOS = [
  { id: "1:1", label: "1:1" },
  { id: "4:3", label: "4:3" },
  { id: "16:9", label: "16:9" },
] as const;

export default function ImageGeneratorInput({
  onSubmit,
  onReferenceImageUpload,
  onClearReferenceImage,
  referenceImageUrl,
  submitting = false,
  disabled = false,
  credits = null,
  showCredits = false,
  error = null,
}: ImageGeneratorInputProps) {
  const [prompt, setPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState<typeof MODELS[number]["id"]>(MODELS[0].id);
  const [selectedResolution, setSelectedResolution] = useState<typeof RESOLUTIONS[number]["id"]>(RESOLUTIONS[0].id);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<typeof ASPECT_RATIOS[number]["id"]>(ASPECT_RATIOS[0].id);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showResolutionDropdown, setShowResolutionDropdown] = useState(false);
  const [showAspectRatioDropdown, setShowAspectRatioDropdown] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || submitting || disabled) return;
    await onSubmit(prompt.trim());
    setPrompt("");
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onReferenceImageUpload) {
      await onReferenceImageUpload(file);
    }
    e.target.value = "";
  };

  const handleRemoveReference = () => {
    onClearReferenceImage?.();
  };

  const modelLabel = MODELS.find((m) => m.id === selectedModel)?.name || MODELS[0].name;
  const resolutionLabel = RESOLUTIONS.find((r) => r.id === selectedResolution)?.label || RESOLUTIONS[0].label;
  const aspectRatioLabel = ASPECT_RATIOS.find((a) => a.id === selectedAspectRatio)?.label || ASPECT_RATIOS[0].label;

  return (
    <div className="flex flex-col gap-4">
      {/* Preview Area */}
      <div className="relative">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
            Image Generator
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {selectedResolution === "1K" ? "1024 × 1024" : "2048 × 2048"}
          </span>
        </div>
        
        <div className="border-2 border-blue-500 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900">
          {referenceImageUrl ? (
            <div className="relative aspect-square max-w-[300px]">
              <Image
                src={referenceImageUrl}
                alt="Preview"
                fill
                className="object-cover"
                unoptimized
              />
              <button
                type="button"
                onClick={handleRemoveReference}
                className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full text-white hover:bg-black/80 transition-colors"
                aria-label="Remove image"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center aspect-square max-w-[300px] text-gray-400">
              <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-5-7l-3 3.72L9 13l-3 4h12l-4-5z" />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Input Card */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4 border border-gray-200 dark:border-gray-700">
        <form onSubmit={handleSubmit}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Error Message */}
          {error && (
            <div className="mb-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Reference Image Preview (if uploaded) */}
          {referenceImageUrl && (
            <div className="mb-3 flex items-center gap-3 p-2 rounded-lg bg-gray-50 dark:bg-gray-700">
              <div className="relative w-12 h-12 rounded overflow-hidden">
                <Image
                  src={referenceImageUrl}
                  alt="Reference"
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                  Reference image
                </p>
              </div>
              <button
                type="button"
                onClick={handleRemoveReference}
                className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400 transition-colors"
                aria-label="Remove reference"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Controls Row */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {/* Model Selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowModelDropdown(!showModelDropdown);
                  setShowResolutionDropdown(false);
                  setShowAspectRatioDropdown(false);
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <span>{modelLabel}</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showModelDropdown && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                  {MODELS.map((model) => (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => {
                        setSelectedModel(model.id);
                        setShowModelDropdown(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm ${
                        selectedModel === model.id
                          ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                          : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                      }`}
                    >
                      {model.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Resolution Selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowResolutionDropdown(!showResolutionDropdown);
                  setShowModelDropdown(false);
                  setShowAspectRatioDropdown(false);
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <span>{resolutionLabel}</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showResolutionDropdown && (
                <div className="absolute top-full left-0 mt-1 w-24 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                  {RESOLUTIONS.map((res) => (
                    <button
                      key={res.id}
                      type="button"
                      onClick={() => {
                        setSelectedResolution(res.id);
                        setShowResolutionDropdown(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm ${
                        selectedResolution === res.id
                          ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                          : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                      }`}
                    >
                      {res.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Aspect Ratio Selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowAspectRatioDropdown(!showAspectRatioDropdown);
                  setShowModelDropdown(false);
                  setShowResolutionDropdown(false);
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <span>{aspectRatioLabel}</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showAspectRatioDropdown && (
                <div className="absolute top-full left-0 mt-1 w-20 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                  {ASPECT_RATIOS.map((ratio) => (
                    <button
                      key={ratio.id}
                      type="button"
                      onClick={() => {
                        setSelectedAspectRatio(ratio.id);
                        setShowAspectRatioDropdown(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm ${
                        selectedAspectRatio === ratio.id
                          ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                          : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                      }`}
                    >
                      {ratio.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Upload Reference Image Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={submitting}
              className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Upload reference image"
              title="Upload reference image"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
          </div>

          {/* Input Field */}
          <div className="relative">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="今天我们要创作什么"
              disabled={submitting || disabled}
              className="w-full px-4 py-3 pr-24 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none border border-transparent focus:border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            />

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!prompt.trim() || submitting || disabled}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2 px-4 py-1.5 rounded-lg bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-800 text-sm font-medium hover:bg-gray-700 dark:hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white dark:border-gray-800/30 dark:border-t-gray-800 rounded-full animate-spin" />
                  <span>生成中...</span>
                </>
              ) : (
                <>
                  {showCredits && credits !== null && (
                    <span className="text-xs">+{credits}</span>
                  )}
                  <span>生成</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
