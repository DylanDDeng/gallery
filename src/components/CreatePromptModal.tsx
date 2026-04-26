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
      <div className="absolute inset-0 bg-[#0c0b09]/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-2xl mx-4 rounded-3xl bg-[#f5f2ed] dark:bg-[#141210] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e0d9ce] dark:border-[#1a1814]">
          <h2 className="text-lg font-semibold text-[#141210] dark:text-[#e0d9ce]">Create from Prompt</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-[#8a837a] hover:text-[#4a443c] dark:hover:text-[#d5cfc4] hover:bg-[#e0d9ce] dark:hover:bg-[#1a1814] transition-colors"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-[#2a2520] dark:text-[#a39b90] mb-2">
              Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={6}
              className="w-full rounded-xl border border-[#d5cfc4] dark:border-[#2a2520] bg-[#f5f2ed] dark:bg-[#1a1814] px-4 py-3 text-[#141210] dark:text-[#e0d9ce] placeholder-[#8a837a] dark:placeholder-[#4a443c] outline-none focus:border-[#8a837a] dark:focus:border-[#5c564e] resize-none"
              placeholder="Describe the image you want to generate..."
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-[#2a2520] dark:text-[#a39b90] mb-2">
                Model
              </label>
              <div className="space-y-2">
                {MODEL_OPTIONS.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => setSelectedModel(model.id)}
                    className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all ${
                      selectedModel === model.id
                        ? "bg-[#e0d9ce] border border-[#141210] text-[#141210] dark:bg-[#1a1814] dark:border-[#e0d9ce] dark:text-[#e0d9ce]"
                        : "bg-[#ebe7e0] dark:bg-[#1a1814] border border-transparent text-[#2a2520] dark:text-[#a39b90] hover:border-[#d5cfc4] dark:hover:border-[#2a2520]"
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      selectedModel === model.id ? "border-[#141210] dark:border-[#e0d9ce]" : "border-[#a39b90] dark:border-[#4a443c]"
                    }`}>
                      {selectedModel === model.id && <div className="w-2 h-2 rounded-full bg-[#141210] dark:bg-[#e0d9ce]" />}
                    </div>
                    <span className="text-sm font-medium">{model.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="modal-aspect-ratio" className="block text-sm font-medium text-[#2a2520] dark:text-[#a39b90] mb-2">
                Aspect ratio
              </label>
              <select
                id="modal-aspect-ratio"
                value={selectedAspectRatio}
                onChange={(event) => setSelectedAspectRatio(event.target.value as AspectRatio)}
                className="w-full rounded-xl border border-[#d5cfc4] dark:border-[#2a2520] bg-[#ebe7e0] dark:bg-[#1a1814] px-4 py-3 text-sm text-[#141210] dark:text-[#e0d9ce] outline-none focus:border-[#8a837a] dark:focus:border-[#5c564e]"
              >
                {ASPECT_RATIO_OPTIONS.map((ratio) => (
                  <option key={ratio.id} value={ratio.id}>
                    {ratio.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="modal-resolution" className="block text-sm font-medium text-[#2a2520] dark:text-[#a39b90] mb-2">
                Resolution
              </label>
              <select
                id="modal-resolution"
                value={selectedResolution}
                onChange={(event) => setSelectedResolution(event.target.value as OutputResolution)}
                className="w-full rounded-xl border border-[#d5cfc4] dark:border-[#2a2520] bg-[#ebe7e0] dark:bg-[#1a1814] px-4 py-3 text-sm text-[#141210] dark:text-[#e0d9ce] outline-none focus:border-[#8a837a] dark:focus:border-[#5c564e]"
              >
                {OUTPUT_RESOLUTIONS.map((resolution) => (
                  <option key={resolution.id} value={resolution.id}>
                    {getResolutionCreditsLabel(selectedModel, resolution.id)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-xl bg-[#ebe7e0] px-4 py-3 text-sm text-[#4a443c] ring-1 ring-[#d5cfc4] dark:bg-[#1a1814]/60 dark:text-[#a39b90] dark:ring-[#2a2520]">
            Output size: {selectedAspectRatio} · {selectedResolution} · {selectedOutputSize.size}
            <span className="ml-2 font-medium text-[#141210] dark:text-[#e0d9ce]">
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
            className="w-full rounded-2xl bg-[#141210] py-4 text-lg font-semibold text-[#f5f2ed] transition-colors hover:bg-[#2a2520] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#f5f2ed] dark:text-[#141210] dark:hover:bg-[#d5cfc4]"
          >
            {generating ? (
              <span className="flex items-center justify-center gap-2">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#f5f2ed]/30 border-t-white" />
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
