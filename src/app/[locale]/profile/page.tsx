"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Heart, X } from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import EditorialModalCloseButton from "@/components/EditorialModalCloseButton";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import UserMenu from "@/components/UserMenu";
import { Link, useRouter } from "@/i18n/navigation";
import { MAGAZINE_COVER_IMAGE, MOCK_IMAGES } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { getModelDisplayName } from "@/lib/model-pricing";
import { maskPhone } from "@/lib/phone";
import type { Locale } from "@/i18n/routing";
import type { ImagePrompt } from "@/lib/types";
import { useAppStore } from "@/store";

type ProfileTab = "works" | "favorites";

interface GenerationTask {
  id: string;
  prompt: string;
  model: string;
  status: string;
  result_url?: string;
  created_at: string;
}

interface ProfileRecord {
  id: string;
  email?: string;
  name?: string;
  avatar_url?: string;
  credits: number;
  created_at?: string;
  updated_at?: string;
}

interface WorkPeriod {
  key: string;
  label: string;
  works: GenerationTask[];
}

const PREVIEW_WORKS: GenerationTask[] = MOCK_IMAGES.slice(0, 8).map(
  (image, index) => ({
    id: `preview-work-${image.id}`,
    prompt: image.tags[0] || `Aestara study ${index + 1}`,
    model: image.model,
    status: "completed",
    result_url: image.url,
    created_at: image.created_at,
  }),
);

function profileImageAlt(label: string, detail: string) {
  return detail ? `${label}: ${detail}` : label;
}

function groupWorksByPeriod(
  works: GenerationTask[],
  locale: Locale,
  thisWeekLabel: string,
): WorkPeriod[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  const recentCutoff = new Date(now);
  recentCutoff.setDate(now.getDate() - 7);
  const monthFormatter = new Intl.DateTimeFormat(
    locale === "zh" ? "zh-CN" : "en-US",
    { month: locale === "zh" ? "numeric" : "long" },
  );
  const groups = new Map<string, WorkPeriod>();

  [...works]
    .sort(
      (left, right) =>
        new Date(right.created_at).getTime() -
        new Date(left.created_at).getTime(),
    )
    .forEach((work) => {
      const createdAt = new Date(work.created_at);
      if (Number.isNaN(createdAt.getTime())) return;

      const isRecent = createdAt >= recentCutoff && createdAt <= now;
      const year = createdAt.getFullYear();
      const month = monthFormatter.format(createdAt);
      const key = isRecent
        ? "recent"
        : year === currentYear
          ? `${year}-${createdAt.getMonth()}`
          : String(year);
      const label = isRecent
        ? `${month} · ${thisWeekLabel}`
        : year === currentYear
          ? month
          : String(year);

      const existing = groups.get(key);
      if (existing) existing.works.push(work);
      else groups.set(key, { key, label, works: [work] });
    });

  return Array.from(groups.values());
}

export default function ProfilePage() {
  const t = useTranslations("profile");
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAppStore((state) => state.user);
  const authInitialized = useAppStore((state) => state.authInitialized);
  const credits = useAppStore((state) => state.credits);
  const favorites = useAppStore((state) => state.favorites);
  const favoritesLoaded = useAppStore((state) => state.favoritesLoaded);
  const toggleFavorite = useAppStore((state) => state.toggleFavorite);
  const setUser = useAppStore((state) => state.setUser);

  const isPreview =
    process.env.NODE_ENV === "development" &&
    searchParams.get("preview") === "1";
  const activeTab: ProfileTab =
    searchParams.get("tab") === "favorites" ? "favorites" : "works";

  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [works, setWorks] = useState<GenerationTask[]>([]);
  const [favoriteImages, setFavoriteImages] = useState<ImagePrompt[]>([]);
  const [loadingWorks, setLoadingWorks] = useState(true);
  const [loadingFavorites, setLoadingFavorites] = useState(true);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [workColumnCount, setWorkColumnCount] = useState(2);

  useEffect(() => {
    const desktopColumns = window.matchMedia("(min-width: 1024px)");
    const updateColumnCount = () =>
      setWorkColumnCount(desktopColumns.matches ? 4 : 2);

    updateColumnCount();
    desktopColumns.addEventListener("change", updateColumnCount);
    return () =>
      desktopColumns.removeEventListener("change", updateColumnCount);
  }, []);

  useEffect(() => {
    if (!selectedUrl && !editOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedUrl(null);
        setEditOpen(false);
      }
    };
    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [editOpen, selectedUrl]);

  useEffect(() => {
    if (authInitialized && !user && !isPreview) router.replace("/");
  }, [authInitialized, isPreview, router, user]);

  useEffect(() => {
    if (isPreview) {
      setProfile({
        id: "preview-user",
        email: "lin@example.com",
        name: locale === "zh" ? "林予安" : "Lin Yu'an",
        avatar_url: MAGAZINE_COVER_IMAGE.url,
        credits: 128,
      });
      setWorks(PREVIEW_WORKS);
      setFavoriteImages(MOCK_IMAGES.slice(0, 8));
      setLoadingWorks(false);
      setLoadingFavorites(false);
      return;
    }

    if (!user) return;
    let cancelled = false;

    Promise.all([
      fetch("/api/profile").then(async (response) => {
        const json = (await response.json()) as {
          profile?: ProfileRecord;
          error?: string;
        };
        if (!response.ok) throw new Error(json.error || t("loadError"));
        return json.profile ?? null;
      }),
      fetch("/api/generations?status=completed&limit=50").then(
        async (response) => {
          const json = (await response.json()) as {
            data?: GenerationTask[];
            error?: string;
          };
          if (!response.ok) throw new Error(json.error || t("loadError"));
          return json.data ?? [];
        },
      ),
    ])
      .then(([nextProfile, nextWorks]) => {
        if (cancelled) return;
        setProfile(nextProfile);
        setWorks(nextWorks.filter((work) => work.result_url));
      })
      .catch(() => {
        if (!cancelled) setProfileError(t("loadError"));
      })
      .finally(() => {
        if (!cancelled) setLoadingWorks(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isPreview, locale, t, user]);

  useEffect(() => {
    if (isPreview || !user || !favoritesLoaded) return;
    if (favorites.length === 0) {
      setFavoriteImages([]);
      setLoadingFavorites(false);
      return;
    }

    let cancelled = false;
    setLoadingFavorites(true);
    const params = new URLSearchParams({
      ids: favorites.join(","),
      limit: String(Math.min(favorites.length, 100)),
    });

    fetch(`/api/images?${params.toString()}`)
      .then(async (response) => {
        const json = (await response.json()) as {
          data?: ImagePrompt[];
          error?: string;
        };
        if (!response.ok) throw new Error(json.error || t("loadError"));
        if (!cancelled) setFavoriteImages(json.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setProfileError(t("loadError"));
      })
      .finally(() => {
        if (!cancelled) setLoadingFavorites(false);
      });

    return () => {
      cancelled = true;
    };
  }, [favorites, favoritesLoaded, isPreview, t, user]);

  const displayName =
    profile?.name ||
    user?.user_metadata?.name ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    (user?.phone_confirmed_at && user.phone ? maskPhone(user.phone) : "") ||
    tCommon("user");
  const avatarUrl =
    profile?.avatar_url ||
    user?.user_metadata?.avatar_url ||
    user?.user_metadata?.picture;
  const creditBalance = profile?.credits ?? credits ?? 0;
  const favoriteCount = isPreview ? favoriteImages.length : favorites.length;
  const getCategoryLabel = (category: string) => {
    try {
      return tCommon(
        `categories.${category}` as "categories.portrait",
      );
    } catch {
      return category;
    }
  };
  const selectedFavorite = useMemo(
    () => favoriteImages.find((image) => image.url === selectedUrl),
    [favoriteImages, selectedUrl],
  );
  const selectedWork = useMemo(
    () => works.find((work) => work.result_url === selectedUrl),
    [selectedUrl, works],
  );
  const workPeriods = useMemo(
    () => groupWorksByPeriod(works, locale, t("timelineThisWeek")),
    [locale, t, works],
  );

  const switchTab = (tab: ProfileTab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "works") params.delete("tab");
    else params.set("tab", tab);
    const query = params.toString();
    router.replace(query ? `/profile?${query}` : "/profile");
  };

  const openEditor = () => {
    setDraftName(displayName);
    setProfileError(null);
    setEditOpen(true);
  };

  const saveProfile = async () => {
    const name = draftName.trim();
    if (!name || name.length > 50) {
      setProfileError(t("edit.nameError"));
      return;
    }

    if (isPreview) {
      setProfile((current) => (current ? { ...current, name } : current));
      setEditOpen(false);
      return;
    }

    setSavingProfile(true);
    setProfileError(null);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = (await response.json()) as {
        profile?: ProfileRecord;
        error?: string;
      };
      if (!response.ok || !json.profile) {
        throw new Error(json.error || t("edit.saveError"));
      }
      setProfile(json.profile);
      if (user) {
        setUser({
          ...user,
          user_metadata: { ...user.user_metadata, name },
        });
      }
      setEditOpen(false);
    } catch {
      setProfileError(t("edit.saveError"));
    } finally {
      setSavingProfile(false);
    }
  };

  if (!isPreview && (!authInitialized || !user)) return null;

  return (
    <div className="min-h-screen bg-[#f5f2ed] text-[#2a2520] dark:bg-[#0c0b09] dark:text-[#c4bdb4]">
      <header className="sticky top-0 z-40 border-b border-[#d5cfc4]/80 bg-[#f5f2ed]/95 backdrop-blur-md dark:border-[#f5f2ed]/10 dark:bg-[#0c0b09]/95">
        <div className="mx-auto flex h-[76px] max-w-[1600px] items-center justify-between px-6 lg:px-8">
          <Link
            href="/"
            className="select-none text-[29px] font-bold leading-none text-[#2a2520] dark:text-[#c4bdb4]"
            style={{ fontFamily: "'Caveat', cursive" }}
          >
            {tCommon("brand")}
          </Link>
          <nav className="hidden items-center gap-16 text-[13px] font-medium text-[#4a443c] md:flex dark:text-[#a39b90]">
            <Link href="/" className="transition-colors hover:text-[#141210] dark:hover:text-[#e0d9ce]">{tNav("gallery")}</Link>
            <Link href="/generate" className="transition-colors hover:text-[#141210] dark:hover:text-[#e0d9ce]">{tNav("create")}</Link>
          </nav>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <span className="hidden text-sm text-[#4a443c] sm:inline dark:text-[#a39b90]">{t("title")}</span>
            {isPreview ? (
              <div className="relative h-9 w-9 overflow-hidden rounded-full bg-[#d5cfc4]">
                <Image src={avatarUrl || MAGAZINE_COVER_IMAGE.url} alt="" fill sizes="36px" className="object-cover" loading="eager" unoptimized />
              </div>
            ) : (
              <UserMenu />
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1600px] md:min-h-[calc(100vh-76px)] md:grid-cols-[278px_minmax(0,1fr)]">
        <aside className="border-b border-[#d5cfc4]/80 px-6 py-8 md:border-b-0 md:px-8 md:py-20 dark:border-[#f5f2ed]/10">
          <div className="flex items-center gap-5 md:block">
            <div className="relative h-24 w-24 flex-none overflow-hidden rounded-full bg-[#d5cfc4] md:h-28 md:w-28 dark:bg-[#2a2520]">
              {avatarUrl ? (
                <Image src={avatarUrl} alt="" fill sizes="112px" className="object-cover" loading="eager" unoptimized />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-3xl font-semibold text-[#5c564e] dark:text-[#a39b90]">{displayName.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="min-w-0 md:mt-6">
              <h1 className="truncate text-2xl font-semibold tracking-tight text-[#141210] dark:text-[#e0d9ce]">{displayName}</h1>
              <p className="mt-2 text-sm text-[#5c564e] dark:text-[#8a837a]">{tCommon("creditsCount", { count: creditBalance })}</p>
              <button type="button" onClick={openEditor} className="mt-4 border-b border-[#8a837a] pb-1 text-sm text-[#5c564e] transition-colors hover:border-[#141210] hover:text-[#141210] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#5c564e] dark:text-[#8a837a] dark:hover:border-[#e0d9ce] dark:hover:text-[#e0d9ce]">
                {t("editProfile")}
              </button>
            </div>
          </div>

          <nav aria-label={t("collectionsLabel")} className="mt-8 grid grid-cols-2 border-t border-[#d5cfc4]/70 pt-5 md:mt-24 md:block md:border-t-0 md:pt-0 dark:border-[#f5f2ed]/10">
            <CollectionTab active={activeTab === "works"} label={t("works")} count={works.length} onClick={() => switchTab("works")} />
            <div className="hidden h-px bg-[#d5cfc4]/70 md:block dark:bg-[#f5f2ed]/10" />
            <CollectionTab active={activeTab === "favorites"} label={t("favorites")} count={favoriteCount} onClick={() => switchTab("favorites")} />
          </nav>
        </aside>

        <main className="min-w-0 px-6 py-10 lg:px-12 lg:py-16">
          <div className="mb-8 flex items-end justify-between gap-6">
            <div>
              <p className="mb-3 text-[10px] uppercase tracking-[0.22em] text-[#a39b90] dark:text-[#5c564e]">{t("title")}</p>
              <h2 className="text-3xl font-semibold tracking-tight text-[#141210] lg:text-4xl dark:text-[#e0d9ce]">
                {activeTab === "favorites" ? t("favoritesTitle") : t("worksTitle")}
              </h2>
            </div>
            <Link href={activeTab === "favorites" ? "/" : "/generate"} className="group hidden items-center gap-2 pb-1 text-sm text-[#5c564e] transition-colors hover:text-[#141210] sm:flex dark:text-[#8a837a] dark:hover:text-[#e0d9ce]">
              {activeTab === "favorites" ? t("discoverMore") : t("continueCreating")}
              <ArrowRight size={16} weight="light" className="transition-transform group-hover:translate-x-1" aria-hidden />
            </Link>
          </div>

          {profileError && !editOpen && <p role="alert" className="mb-6 text-sm text-[#8c463e] dark:text-[#c8776e]">{profileError}</p>}

          {(activeTab === "works" ? loadingWorks : loadingFavorites) ? (
            <p className="py-24 text-center text-sm text-[#8a837a] dark:text-[#5c564e]">{tCommon("loading")}</p>
          ) : activeTab === "works" ? (
            works.length === 0 ? (
              <EmptyCollection title={t("emptyWorks")} action={t("createFirst")} href="/generate" />
            ) : (
              <div className="border-t border-[#d5cfc4]/70 dark:border-[#f5f2ed]/10">
                {workPeriods.map((period, periodIndex) => (
                  <section key={period.key} className="relative grid grid-cols-[72px_minmax(0,1fr)] border-b border-[#d5cfc4]/70 py-7 sm:grid-cols-[92px_minmax(0,1fr)] lg:grid-cols-[108px_minmax(0,1fr)] lg:py-8 dark:border-[#f5f2ed]/10">
                    <div className="relative pr-4 sm:pr-6">
                      <span className="absolute bottom-[-29px] left-[5px] top-4 w-px bg-[#d5cfc4] lg:bottom-[-33px] dark:bg-[#2a2520]" aria-hidden />
                      <span className="absolute left-[2px] top-[7px] h-[7px] w-[7px] rounded-full bg-[#b6aea3] dark:bg-[#5c564e]" aria-hidden />
                      <h3 className="pl-4 text-[13px] font-medium leading-5 text-[#4a443c] sm:text-sm dark:text-[#a39b90]">
                        {period.label}
                      </h3>
                    </div>
                    <div className="grid min-w-0 grid-cols-2 items-start gap-2.5 sm:gap-3 lg:grid-cols-4">
                      {Array.from({ length: workColumnCount }, (_, columnIndex) => (
                        <div key={columnIndex} className="min-w-0 space-y-2.5 sm:space-y-3">
                          {period.works
                            .filter((_, index) => index % workColumnCount === columnIndex)
                            .map((work, columnItemIndex) => {
                              const originalIndex =
                                columnIndex + columnItemIndex * workColumnCount;

                              return (
                                <button
                                  key={work.id}
                                  type="button"
                                  onClick={() => setSelectedUrl(work.result_url || null)}
                                  className="group block w-full text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#5c564e]"
                                >
                                  <div className="overflow-hidden bg-[#e0d9ce] dark:bg-[#141210]">
                                    <Image
                                      src={work.result_url || ""}
                                      alt={profileImageAlt(t("works"), work.prompt)}
                                      width={1600}
                                      height={1600}
                                      sizes="(max-width: 1024px) 50vw, 25vw"
                                      className="block h-auto w-full transition duration-700 group-hover:scale-[1.015]"
                                      loading={isPreview || (periodIndex === 0 && originalIndex < 4) ? "eager" : "lazy"}
                                      unoptimized
                                    />
                                  </div>
                                </button>
                              );
                            })}
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )
          ) : favoriteImages.length === 0 ? (
            <EmptyCollection title={t("emptyFavorites")} action={t("discoverFirst")} href="/" />
          ) : (
            <div className="grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2 xl:grid-cols-4">
              {favoriteImages.map((image, index) => (
                <article key={image.id} className="group relative">
                  <button type="button" onClick={() => setSelectedUrl(image.url)} className="block w-full text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#5c564e]">
                    <div className="relative aspect-[3/4] overflow-hidden bg-[#e0d9ce] dark:bg-[#141210]">
                      <Image src={image.url} alt={profileImageAlt(t("favorites"), getCategoryLabel(image.category))} fill sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw" className="object-cover transition duration-700 group-hover:scale-[1.015]" loading={isPreview || index < 4 ? "eager" : "lazy"} unoptimized />
                      <div className="absolute inset-x-0 bottom-0 bg-[#141210]/72 px-4 py-4 text-[#f5f2ed] backdrop-blur-[2px]">
                        <p className="text-sm">{image.category ? getCategoryLabel(image.category) : tCommon("untitled")}</p>
                        <p className="mt-1 text-[11px] text-[#d5cfc4]">{image.author}</p>
                        <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[#a39b90]">{image.model}</p>
                      </div>
                    </div>
                  </button>
                  <button type="button" onClick={() => {
                    if (isPreview) setFavoriteImages((current) => current.filter((item) => item.id !== image.id));
                    else toggleFavorite(image.id);
                  }} aria-label={t("removeFavorite")} className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#f5f2ed]/88 text-[#a95f57] shadow-sm backdrop-blur-sm transition hover:bg-[#f5f2ed] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5f2ed]">
                    <Heart size={20} weight="fill" aria-hidden />
                  </button>
                </article>
              ))}
            </div>
          )}
        </main>
      </div>

      {selectedUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("previewLabel")}
          className="fixed inset-0 z-50 flex flex-col bg-[#f5f2ed]"
          onClick={() => setSelectedUrl(null)}
        >
          <div
            className="flex flex-shrink-0 items-center justify-between border-b border-[#d5cfc4]/50 px-5 py-3 md:px-8 md:py-4"
            onClick={(event) => event.stopPropagation()}
          >
            <EditorialModalCloseButton
              ariaLabel={t("closePreview")}
              onClick={() => setSelectedUrl(null)}
            />
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#a39b90]/60">
              {activeTab === "favorites" ? t("favorites") : t("works")}
            </span>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
            <div
              className="relative flex min-h-0 flex-1 items-center justify-center bg-[#ebe7e0] px-4 py-6 md:px-10 md:py-10"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="relative h-full w-full max-w-[900px]">
                <Image
                  src={selectedUrl}
                  alt={t("previewLabel")}
                  fill
                  sizes="(max-width: 768px) 100vw, 60vw"
                  className="object-contain object-center"
                  priority
                  unoptimized
                />
              </div>
            </div>

            <aside
              className="relative flex h-[42dvh] w-full flex-shrink-0 flex-col border-t border-[#d5cfc4]/40 bg-[#f5f2ed] md:h-auto md:w-[400px] md:border-l md:border-t-0 lg:w-[460px]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex-1 overflow-y-auto overscroll-contain px-8 py-6 scrollbar-hide md:px-12 md:py-10">
                <div className="flex min-h-full flex-col">
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.35em] text-[#a39b90]">
                      {activeTab === "favorites" ? t("favorites") : t("works")}
                    </p>
                    {activeTab === "favorites" && selectedFavorite ? (
                      <>
                        <h3 className="mt-5 text-3xl font-semibold tracking-tight text-[#2a2520]">
                          {selectedFavorite.category
                            ? getCategoryLabel(selectedFavorite.category)
                            : tCommon("untitled")}
                        </h3>
                        <p className="mt-4 text-[11px] uppercase leading-6 tracking-[0.16em] text-[#8a837a]">
                          {`${selectedFavorite.author} · ${selectedFavorite.model}`}
                        </p>
                      </>
                    ) : selectedWork ? (
                      <>
                        <p className="mt-8 text-[9px] uppercase tracking-[0.35em] text-[#a39b90]">
                          {t("promptLabel")}
                        </p>
                        <p
                          className="mt-5 whitespace-pre-wrap break-words text-[15px] font-normal leading-8 text-[#5c564e]"
                          style={{ fontFamily: "'Instrument Serif', serif" }}
                        >
                          {selectedWork.prompt || tCommon("untitled")}
                        </p>
                        <p className="mt-8 border-t border-[#d5cfc4]/60 pt-5 text-[10px] uppercase leading-5 tracking-[0.16em] text-[#8a837a]">
                          {`${getModelDisplayName(selectedWork.model)} · ${formatDate(selectedWork.created_at, locale)}`}
                        </p>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      )}

      {editOpen && (
        <div role="dialog" aria-modal="true" aria-labelledby="profile-editor-title" className="fixed inset-0 z-50 flex items-center justify-center bg-[#0c0b09]/72 p-4 backdrop-blur-sm" onClick={() => setEditOpen(false)}>
          <div className="w-full max-w-md bg-[#f5f2ed] p-7 shadow-2xl dark:bg-[#141210]" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-4">
              <h2 id="profile-editor-title" className="text-2xl font-semibold text-[#141210] dark:text-[#e0d9ce]">{t("edit.title")}</h2>
              <button type="button" onClick={() => setEditOpen(false)} aria-label={t("edit.cancel")} className="flex h-10 w-10 items-center justify-center text-[#5c564e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5c564e] dark:text-[#a39b90]"><X size={20} weight="light" aria-hidden /></button>
            </div>
            <label htmlFor="profile-name" className="mt-8 block text-sm text-[#4a443c] dark:text-[#a39b90]">{t("edit.nameLabel")}</label>
            <input id="profile-name" value={draftName} onChange={(event) => setDraftName(event.target.value)} maxLength={50} autoFocus className="mt-2 h-12 w-full border border-[#c4bdb4] bg-transparent px-4 text-base text-[#141210] outline-none transition focus:border-[#2a2520] dark:border-[#4a443c] dark:text-[#e0d9ce] dark:focus:border-[#c4bdb4]" />
            {profileError && <p role="alert" className="mt-3 text-sm text-[#8c463e] dark:text-[#c8776e]">{profileError}</p>}
            <div className="mt-8 flex justify-end gap-3">
              <button type="button" onClick={() => setEditOpen(false)} className="h-11 px-5 text-sm text-[#5c564e] hover:text-[#141210] dark:text-[#8a837a] dark:hover:text-[#e0d9ce]">{t("edit.cancel")}</button>
              <button type="button" onClick={() => void saveProfile()} disabled={savingProfile} className="h-11 bg-[#141210] px-6 text-sm font-medium text-[#f5f2ed] transition hover:bg-[#2a2520] disabled:opacity-50 dark:bg-[#e0d9ce] dark:text-[#141210] dark:hover:bg-[#f5f2ed]">{savingProfile ? tCommon("saving") : t("edit.save")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CollectionTab({ active, label, count, onClick }: { active: boolean; label: string; count: number; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-current={active ? "page" : undefined} className={`relative w-full py-4 text-left transition-colors md:py-6 ${active ? "text-[#141210] dark:text-[#e0d9ce]" : "text-[#8a837a] hover:text-[#4a443c] dark:text-[#5c564e] dark:hover:text-[#a39b90]"}`}>
      {active && <span className="absolute bottom-0 left-0 top-0 hidden w-[2px] bg-[#2a2520] md:block dark:bg-[#c4bdb4]" />}
      <span className="block text-xl md:pl-8">{label}</span>
      <span className="mt-1 block font-serif text-3xl font-light text-[#a39b90] md:pl-8 dark:text-[#5c564e]">{count}</span>
    </button>
  );
}

function EmptyCollection({ title, action, href }: { title: string; action: string; href: "/" | "/generate" }) {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center border-y border-[#d5cfc4]/70 text-center dark:border-[#f5f2ed]/10">
      <p className="text-lg text-[#5c564e] dark:text-[#8a837a]">{title}</p>
      <Link href={href} className="mt-5 border-b border-[#8a837a] pb-1 text-sm text-[#4a443c] transition hover:border-[#141210] hover:text-[#141210] dark:text-[#a39b90] dark:hover:border-[#e0d9ce] dark:hover:text-[#e0d9ce]">{action}</Link>
    </div>
  );
}
