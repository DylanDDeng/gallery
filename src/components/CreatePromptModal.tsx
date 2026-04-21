"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isBillingEnabled } from "@/lib/billing-feature";
import {
  ASPECT_RATIO_OPTIONS,
  OUTPUT_RESOLUTIONS,
  getOutputSize,
  type AspectRatio,
  type OutputResolution,
} from "@/lib/generation-size-options";
import {
  DEFAULT_MODEL_ID,
  MODEL_OPTIONS,
  getGenerationCreditsCost,
  getResolutionCreditsLabel,
} from "@/lib/model-pricing";
import { useAppStore } from "@/store";

interface CreatePromptModalProps {
  initialPrompt: string;
  onClose: () => void;
}

export default function CreatePromptModal({ initialPrompt, onClose }: CreatePromptModalProps) {
  const router = useRouter();
  const [prompt, setPrompt] = useState(initialPrompt);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL_ID);
  const [selectedResolution, setSelectedResolution] = useState<OutputResolution>("2K");
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<AspectRatio>("1:1");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const credits = useAppStore((s) => s.credits);
  const setSelectedImage = useAppStore((s) => s.setSelectedImage);
  const setShowLoginPrompt = useAppStore((s) => s.setShowLoginPrompt);
  const setCredits = useAppStore((s) => s.setCredits);
  const fetchCredits = useAppStore((s) => s.fetchCredits);
  const billingEnabled = isBillingEnabled();
  const selectedOutputSize = getOutputSize(selectedResolution, selectedAspectRatio);
  const selectedCreditsCost = getGenerationCreditsCost(selectedModel, selectedResolution);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setGenerating(true);
    setError(null);
    const shouldOptimisticallyDeduct =
      billingEnabled && typeof credits === "number" && credits >= selectedCreditsCost;

    if (shouldOptimisticallyDeduct) {
      setCredits(credits - selectedCreditsCost);
    }

    try {
      const res = await fetch("/api/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          model: selectedModel,
          resolution: selectedResolution,
          size: selectedOutputSize.size,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        if (billingEnabled && (shouldOptimisticallyDeduct || res.status === 402)) {
          await fetchCredits();
        }
        if (res.status === 401) {
          onClose();
          setShowLoginPrompt(true);
          return;
        }

        if (billingEnabled && res.status === 402) {
          onClose();
          router.push("/credits");
          return;
        }

        setError(json.error || "Generation failed");
        return;
      }

      if (billingEnabled) {
        if (typeof json.remainingCredits === "number") {
          setCredits(json.remainingCredits);
        } else {
          void fetchCredits();
        }
      }

      onClose();
      if (json.task) {
        setSelectedImage({
          id: json.task.id,
          url: json.downloadUrl || json.task.result_url,
          prompt: prompt.trim(),
          prompt_zh: "",
          prompt_ja: "",
          author: "You",
          model: selectedModel,
          category: "generated",
          tags: [],
          width: selectedOutputSize.width,
          height: selectedOutputSize.height,
          created_at: new Date().toISOString(),
        });
      }
    } catch (err) {
      if (billingEnabled && shouldOptimisticallyDeduct) {
        await fetchCredits();
      }
      console.error("Generation error:", err);
      setError("An error occurred. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-2xl mx-4 rounded-3xl bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Create from Prompt</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={6}
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-3 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none focus:border-zinc-400 dark:focus:border-zinc-500 resize-none"
              placeholder="Describe the image you want to generate..."
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Model
              </label>
              <div className="space-y-2">
                {MODEL_OPTIONS.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => setSelectedModel(model.id)}
                    className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all ${
                      selectedModel === model.id
                        ? "bg-zinc-100 border border-zinc-900 text-zinc-900 dark:bg-zinc-800 dark:border-zinc-100 dark:text-zinc-100"
                        : "bg-zinc-50 dark:bg-zinc-800 border border-transparent text-zinc-700 dark:text-zinc-300 hover:border-zinc-200 dark:hover:border-zinc-700"
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      selectedModel === model.id ? "border-zinc-900 dark:border-zinc-100" : "border-zinc-300 dark:border-zinc-600"
                    }`}>
                      {selectedModel === model.id && <div className="w-2 h-2 rounded-full bg-zinc-900 dark:bg-zinc-100" />}
                    </div>
                    <span className="text-sm font-medium">{model.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="modal-aspect-ratio" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Aspect ratio
              </label>
              <select
                id="modal-aspect-ratio"
                value={selectedAspectRatio}
                onChange={(event) => setSelectedAspectRatio(event.target.value as AspectRatio)}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
              >
                {ASPECT_RATIO_OPTIONS.map((ratio) => (
                  <option key={ratio.id} value={ratio.id}>
                    {ratio.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="modal-resolution" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Resolution
              </label>
              <select
                id="modal-resolution"
                value={selectedResolution}
                onChange={(event) => setSelectedResolution(event.target.value as OutputResolution)}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
              >
                {OUTPUT_RESOLUTIONS.map((resolution) => (
                  <option key={resolution.id} value={resolution.id}>
                    {getResolutionCreditsLabel(selectedModel, resolution.id)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-xl bg-zinc-50 px-4 py-3 text-sm text-zinc-600 ring-1 ring-zinc-200 dark:bg-zinc-800/60 dark:text-zinc-300 dark:ring-zinc-700">
            Output size: {selectedAspectRatio} · {selectedResolution} · {selectedOutputSize.size}
            <span className="ml-2 font-medium text-zinc-900 dark:text-zinc-100">
              · {selectedCreditsCost} credits
            </span>
          </div>

          {error && (
            <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-500 dark:text-red-400">
              {error}
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={generating || !prompt.trim()}
            className="w-full rounded-2xl bg-zinc-900 py-4 text-lg font-semibold text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {generating ? (
              <span className="flex items-center justify-center gap-2">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Generating...
              </span>
            ) : (
              `Generate · ${selectedCreditsCost} credits`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
