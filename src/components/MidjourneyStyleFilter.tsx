"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import GalleryImage from "./GalleryImage";
import { useAppStore } from "@/store";
import { fetchCachedJson } from "@/lib/public-feed-cache";
import {
  formatMidjourneyVersion,
  type StyleCodeKind,
} from "@/lib/midjourney-params";

interface StyleCodeRow {
  code: string;
  count: number;
  cover_url: string | null;
}

interface Facets {
  versions: Array<{ version: string; count: number }>;
  profiles: StyleCodeRow[];
  srefs: StyleCodeRow[];
}

const COLLAPSED_COUNT = 8;

const optionBase =
  "text-[12px] tracking-wide text-[#5c564e] dark:text-[#7a7269] transition-colors duration-200 hover:text-[#2a2520] dark:hover:text-[#c4bdb4]";
const optionActive =
  "text-[#2a2520] dark:text-[#c4bdb4] underline underline-offset-4 decoration-[#2a2520] dark:decoration-[#c4bdb4]";

export default function MidjourneyStyleFilter() {
  const t = useTranslations("sidebar");
  const activeMjVersion = useAppStore((s) => s.activeMjVersion);
  const setActiveMjVersion = useAppStore((s) => s.setActiveMjVersion);
  const activeStyleCode = useAppStore((s) => s.activeStyleCode);
  const setActiveStyleCode = useAppStore((s) => s.setActiveStyleCode);
  const [facets, setFacets] = useState<Facets | null>(null);
  // A tab picked here holds until the code filter changes elsewhere
  // (card chip, image modal); then the tab follows the picked code.
  const styleKey = activeStyleCode ? `${activeStyleCode.kind}:${activeStyleCode.code}` : "";
  const [tabChoice, setTabChoice] = useState<{ kind: StyleCodeKind; key: string } | null>(null);
  const tab: StyleCodeKind =
    tabChoice && tabChoice.key === styleKey
      ? tabChoice.kind
      : activeStyleCode?.kind ?? tabChoice?.kind ?? "p";
  const setTab = (kind: StyleCodeKind) => setTabChoice({ kind, key: styleKey });
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (activeMjVersion !== "all") params.set("version", activeMjVersion);

    fetchCachedJson<Facets>(`/api/midjourney/facets?${params.toString()}`)
      .then((json) => {
        if (!cancelled) setFacets(json);
      })
      .catch(() => {
        if (!cancelled) setFacets(null);
      });

    return () => {
      cancelled = true;
    };
  }, [activeMjVersion]);

  if (!facets) return null;

  const hasProfiles = facets.profiles.length > 0;
  const hasSrefs = facets.srefs.length > 0;
  const shownTab: StyleCodeKind =
    tab === "p" && !hasProfiles && hasSrefs
      ? "sref"
      : tab === "sref" && !hasSrefs && hasProfiles
      ? "p"
      : tab;
  const codes = shownTab === "p" ? facets.profiles : facets.srefs;
  const visibleCodes = expanded ? codes : codes.slice(0, COLLAPSED_COUNT);

  return (
    <div className="ml-1 space-y-5 border-l border-[#d5cfc4] pl-3 dark:border-[#2a2520]">
      {facets.versions.length > 1 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1.5">
          {[{ version: "all" }, ...facets.versions].map(({ version }) => (
            <button
              key={version}
              onClick={() => setActiveMjVersion(version)}
              className={`${optionBase} ${activeMjVersion === version ? optionActive : ""}`}
            >
              {version === "all" ? t("allVersions") : formatMidjourneyVersion(version)}
            </button>
          ))}
        </div>
      )}

      {(hasProfiles || hasSrefs) && (
        <div className="space-y-3">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#a39b90] dark:text-[#4a443c]">
            {t("styleCodes")}
          </p>
          <div className="flex gap-4">
            {hasProfiles && (
              <button
                onClick={() => {
                  setTab("p");
                  setExpanded(false);
                }}
                className={`${optionBase} ${shownTab === "p" ? optionActive : ""}`}
              >
                <span className="font-mono">--p</span> {t("profileTab")}
              </button>
            )}
            {hasSrefs && (
              <button
                onClick={() => {
                  setTab("sref");
                  setExpanded(false);
                }}
                className={`${optionBase} ${shownTab === "sref" ? optionActive : ""}`}
              >
                <span className="font-mono">--sref</span> {t("srefTab")}
              </button>
            )}
          </div>

          <div className="space-y-1">
            {visibleCodes.map((row) => {
              const isActive =
                activeStyleCode?.kind === shownTab && activeStyleCode.code === row.code;
              return (
                <button
                  key={row.code}
                  onClick={() =>
                    setActiveStyleCode(isActive ? null : { kind: shownTab, code: row.code })
                  }
                  className={`group flex w-full items-center gap-2.5 rounded-md px-1 py-1 text-left transition-colors ${
                    isActive
                      ? "bg-[#e0d9ce] dark:bg-[#1a1814]"
                      : "hover:bg-[#ebe7e0] dark:hover:bg-[#141210]"
                  }`}
                >
                  <span className="relative h-6 w-6 shrink-0 overflow-hidden rounded-[3px] bg-[#e0d9ce] dark:bg-[#1a1814]">
                    {row.cover_url && (
                      <GalleryImage
                        src={row.cover_url}
                        alt=""
                        fill
                        sizes="24px"
                        className="object-cover"
                      />
                    )}
                  </span>
                  <span
                    className={`min-w-0 flex-1 truncate font-mono text-[11px] ${
                      isActive
                        ? "text-[#2a2520] dark:text-[#c4bdb4]"
                        : "text-[#5c564e] group-hover:text-[#2a2520] dark:text-[#7a7269] dark:group-hover:text-[#c4bdb4]"
                    }`}
                  >
                    {row.code}
                  </span>
                  <span className="text-[10px] text-[#a39b90] dark:text-[#5c564e]">
                    {row.count}
                  </span>
                </button>
              );
            })}
          </div>

          {codes.length > COLLAPSED_COUNT && (
            <button
              onClick={() => setExpanded((value) => !value)}
              className={`${optionBase} text-[11px]`}
            >
              {expanded ? t("showLess") : t("showAll", { count: codes.length })}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
