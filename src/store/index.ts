import { create } from "zustand";
import type { ImagePrompt } from "@/lib/types";
import { createClient } from "@/lib/supabase-browser";
import { MOCK_IMAGES } from "@/lib/constants";

const CREDITS_DEBUG_PREFIX = "[credits-debug]";
const PAGE_SIZE = 50;
const MAX_IMAGES = 1000;

interface User {
  id: string;
  email?: string;
  user_metadata?: {
    name?: string;
    avatar_url?: string;
    full_name?: string;
    picture?: string;
  };
}

interface AppState {
  selectedImage: ImagePrompt | null;
  allImages: ImagePrompt[];
  defaultFeedHasMore: boolean;
  searchQuery: string;
  activeCategory: string;
  activeTimeFilter: "all" | "today" | "week" | "month";
  activeModel: string;
  favorites: string[];
  showFavoritesOnly: boolean;
  theme: "light" | "dark";
  // Feed pagination
  feedVersion: number;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  // Auth
  user: User | null;
  authInitialized: boolean;
  favoritesLoaded: boolean;
  showLoginPrompt: boolean;
  // Credits
  credits: number | null;
  creditsVersion: number;
  // Actions
  setSelectedImage: (image: ImagePrompt | null) => void;
  setAllImages: (images: ImagePrompt[]) => void;
  setDefaultFeedHasMore: (hasMore: boolean) => void;
  setSearchQuery: (query: string) => void;
  setActiveCategory: (category: string) => void;
  setActiveTimeFilter: (filter: "all" | "today" | "week" | "month") => void;
  setActiveModel: (model: string) => void;
  toggleFavorite: (imageId: string) => void;
  isFavorite: (imageId: string) => boolean;
  toggleShowFavoritesOnly: () => void;
  toggleTheme: () => void;
  // Feed actions
  setIsLoading: (v: boolean) => void;
  setIsLoadingMore: (v: boolean) => void;
  setHasMore: (v: boolean) => void;
  resetFeed: () => void;
  loadInitialPage: () => Promise<void>;
  loadNextPage: () => Promise<void>;
  trimOldImages: () => void;
  // Auth actions
  setUser: (user: User | null) => void;
  setAuthInitialized: (initialized: boolean) => void;
  fetchFavorites: () => Promise<void>;
  setShowLoginPrompt: (show: boolean) => void;
  // Credits actions
  setCredits: (credits: number | null) => void;
  fetchCredits: () => Promise<void>;
}

function buildQueryString(
  offset: number,
  state: Pick<
    AppState,
    | "searchQuery"
    | "activeCategory"
    | "activeTimeFilter"
    | "activeModel"
    | "showFavoritesOnly"
    | "favorites"
  >
) {
  const params = new URLSearchParams({
    limit: String(PAGE_SIZE + 1),
    offset: String(offset),
  });
  const sq = state.searchQuery.trim();
  if (sq) params.set("search", sq);
  if (state.activeCategory !== "all") params.set("category", state.activeCategory);
  if (state.activeTimeFilter !== "all") params.set("time", state.activeTimeFilter);
  if (state.activeModel !== "all") params.set("model", state.activeModel);
  if (state.showFavoritesOnly && state.favorites.length > 0) {
    params.set("ids", state.favorites.join(","));
  }
  return params.toString();
}

let loadMoreInFlight = false;

export const useAppStore = create<AppState>((set, get) => ({
  selectedImage: null,
  allImages: [],
  defaultFeedHasMore: false,
  searchQuery: "",
  activeCategory: "all",
  activeTimeFilter: "all",
  activeModel: "all",
  favorites: [],
  showFavoritesOnly: false,
  theme: "light",
  // Feed pagination
  feedVersion: 0,
  isLoading: false,
  isLoadingMore: false,
  hasMore: false,
  // Auth
  user: null,
  authInitialized: false,
  favoritesLoaded: false,
  showLoginPrompt: false,
  // Credits
  credits: null,
  creditsVersion: 0,

  setSelectedImage: (image) => set({ selectedImage: image }),
  setAllImages: (images) => set({ allImages: images }),
  setDefaultFeedHasMore: (hasMore) => set({ defaultFeedHasMore: hasMore }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setActiveCategory: (category) => set({ activeCategory: category }),
  setActiveTimeFilter: (filter) => set({ activeTimeFilter: filter }),
  setActiveModel: (model) => set({ activeModel: model }),
  toggleShowFavoritesOnly: () =>
    set((state) => ({ showFavoritesOnly: !state.showFavoritesOnly })),

  toggleTheme: () =>
    set((state) => {
      const next = state.theme === "light" ? "dark" : "light";
      if (next === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      localStorage.setItem("theme", next);
      return { theme: next };
    }),

  setIsLoading: (v) => set({ isLoading: v }),
  setIsLoadingMore: (v) => set({ isLoadingMore: v }),
  setHasMore: (v) => set({ hasMore: v }),

  resetFeed: () =>
    set((state) => ({
      feedVersion: state.feedVersion + 1,
      allImages: [],
      hasMore: false,
      isLoading: false,
      isLoadingMore: false,
    })),

  loadInitialPage: async () => {
    const state = get();
    if (state.isLoading || state.isLoadingMore) return;
    if (state.showFavoritesOnly && state.favorites.length === 0) return;
    if (!state.favoritesLoaded && state.showFavoritesOnly) return;

    const version = state.feedVersion + 1;
    set({
      feedVersion: version,
      isLoading: true,
      isLoadingMore: false,
      hasMore: false,
      allImages: [],
    });

    try {
      const qs = buildQueryString(0, state);
      const res = await fetch(`/api/images?${qs}`);
      const json = (await res.json()) as {
        data?: ImagePrompt[];
        hasMore?: boolean;
        error?: string;
      };

      if (!res.ok) throw new Error(json.error || "Failed");

      const current = get();
      if (current.feedVersion !== version) return;

      const rawData = json.data ?? [];
      const hasMore = rawData.length > PAGE_SIZE;
      const data = hasMore ? rawData.slice(0, PAGE_SIZE) : rawData;

      const isDefaultFeed =
        !state.searchQuery.trim() &&
        state.activeCategory === "all" &&
        state.activeTimeFilter === "all" &&
        state.activeModel === "all" &&
        !state.showFavoritesOnly;

      if (data.length === 0 && isDefaultFeed) {
        set({
          allImages: MOCK_IMAGES,
          hasMore: false,
          isLoading: false,
          defaultFeedHasMore: false,
        });
      } else {
        set({
          allImages: data,
          hasMore,
          isLoading: false,
          defaultFeedHasMore: hasMore,
        });
      }
    } catch {
      const current = get();
      if (current.feedVersion === version) {
        set({ isLoading: false });
      }
    }
  },

  loadNextPage: async () => {
    const state = get();
    if (loadMoreInFlight || !state.hasMore || state.isLoading || state.isLoadingMore) return;
    if (state.showFavoritesOnly && state.favorites.length === 0) return;
    if (!state.favoritesLoaded && state.showFavoritesOnly) return;

    const version = state.feedVersion;
    loadMoreInFlight = true;
    set({ isLoadingMore: true });

    try {
      const offset = state.allImages.length;
      const qs = buildQueryString(offset, state);
      const res = await fetch(`/api/images?${qs}`);
      const json = (await res.json()) as {
        data?: ImagePrompt[];
        hasMore?: boolean;
        error?: string;
      };

      if (!res.ok) throw new Error(json.error || "Failed");

      const current = get();
      if (current.feedVersion !== version) return;

      const rawData = json.data ?? [];
      const hasMore = rawData.length > PAGE_SIZE;
      const data = hasMore ? rawData.slice(0, PAGE_SIZE) : rawData;

      const accumulated = [...current.allImages, ...data];
      set({
        allImages: accumulated,
        hasMore,
        isLoadingMore: false,
        isLoading: false,
        defaultFeedHasMore: hasMore,
      });
    } catch {
      set({ isLoadingMore: false });
    } finally {
      loadMoreInFlight = false;
    }
  },

  trimOldImages: () => {
    const state = get();
    if (state.allImages.length <= MAX_IMAGES) return;

    const trimCount = state.allImages.length - MAX_IMAGES + 50;
    const toRemove = state.allImages.slice(0, trimCount);
    const remaining = state.allImages.slice(trimCount);

    const selectedId = state.selectedImage?.id;
    if (selectedId && toRemove.some((img) => img.id === selectedId)) {
      const selected = state.selectedImage;
      remaining.unshift(selected!);
      if (remaining.length > MAX_IMAGES) remaining.pop();
    }

    set({ allImages: remaining });
  },

  toggleFavorite: (imageId) => {
    const { user, favorites } = get();
    const wasFavorite = favorites.includes(imageId);

    if (!user) {
      set({ showLoginPrompt: true });
      return;
    }

    set({
      favorites: wasFavorite
        ? favorites.filter((id) => id !== imageId)
        : [...favorites, imageId],
    });

    const supabase = createClient();
    if (wasFavorite) {
      supabase
        .from("favorites")
        .delete()
        .eq("image_id", imageId)
        .eq("user_id", user.id)
        .then(({ error }) => {
          if (error) {
            set((s) => ({ favorites: [...s.favorites, imageId] }));
          }
        });
    } else {
      supabase
        .from("favorites")
        .insert({ image_id: imageId, user_id: user.id })
        .then(({ error }) => {
          if (error) {
            set((s) => ({
              favorites: s.favorites.filter((id) => id !== imageId),
            }));
          }
        });
    }
  },

  isFavorite: (imageId) => get().favorites.includes(imageId),

  // Auth actions
  setUser: (user) => set({ user }),
  setAuthInitialized: (initialized) => set({ authInitialized: initialized }),

  fetchFavorites: async () => {
    const { user } = get();
    if (!user) {
      set({ favorites: [], favoritesLoaded: true });
      return;
    }
    const supabase = createClient();
    const { data } = await supabase
      .from("favorites")
      .select("image_id")
      .eq("user_id", user.id);
    set({
      favorites: data ? data.map((f) => f.image_id) : [],
      favoritesLoaded: true,
    });
  },

  setShowLoginPrompt: (show) => set({ showLoginPrompt: show }),

  // Credits actions
  setCredits: (credits: number | null) =>
    set((state) => ({
      ...(console.info(
        CREDITS_DEBUG_PREFIX,
        "setCredits",
        {
          from: state.credits,
          to: credits,
          fromVersion: state.creditsVersion,
          toVersion: state.creditsVersion + 1,
        }
      ),
      {}),
      credits,
      creditsVersion: state.creditsVersion + 1,
    })),

  fetchCredits: async () => {
    const { user, creditsVersion } = get();
    if (!user) {
      set((state) => ({
        ...(console.info(
          CREDITS_DEBUG_PREFIX,
          "fetchCredits:no-user",
          {
            currentCredits: state.credits,
            fromVersion: state.creditsVersion,
            toVersion: state.creditsVersion + 1,
          }
        ),
        {}),
        credits: null,
        creditsVersion: state.creditsVersion + 1,
      }));
      return;
    }

    const requestUserId = user.id;
    const requestVersion = creditsVersion;
    console.info(CREDITS_DEBUG_PREFIX, "fetchCredits:start", {
      requestUserId,
      requestVersion,
      currentCredits: get().credits,
    });

    try {
      const res = await fetch("/api/credits");
      const json = await res.json();
      if (res.ok) {
        const currentState = get();
        if (
          currentState.user?.id !== requestUserId ||
          currentState.creditsVersion !== requestVersion
        ) {
          console.info(CREDITS_DEBUG_PREFIX, "fetchCredits:stale-skip", {
            requestUserId,
            requestVersion,
            responseCredits: json.credits,
            currentUserId: currentState.user?.id ?? null,
            currentVersion: currentState.creditsVersion,
            currentCredits: currentState.credits,
          });
          return;
        }

        set((state) => ({
          ...(console.info(
            CREDITS_DEBUG_PREFIX,
            "fetchCredits:apply",
            {
              requestUserId,
              requestVersion,
              responseCredits: json.credits,
              fromCredits: state.credits,
              fromVersion: state.creditsVersion,
              toVersion: state.creditsVersion + 1,
            }
          ),
          {}),
          credits: json.credits,
          creditsVersion: state.creditsVersion + 1,
        }));
      } else {
        console.warn(CREDITS_DEBUG_PREFIX, "fetchCredits:error-response", {
          requestUserId,
          requestVersion,
          status: res.status,
          body: json,
        });
      }
    } catch (error) {
      console.error(CREDITS_DEBUG_PREFIX, "fetchCredits:exception", error);
    }
  },
}));
