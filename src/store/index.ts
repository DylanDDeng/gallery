import { create } from "zustand";
import type { ImagePrompt } from "@/lib/types";
import { createClient } from "@/lib/supabase-browser";

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
  searchQuery: string;
  activeCategory: string;
  activeTimeFilter: "all" | "today" | "week" | "month";
  favorites: string[];
  showFavoritesOnly: boolean;
  theme: "light" | "dark";
  // Auth
  user: User | null;
  favoritesLoaded: boolean;
  showLoginPrompt: boolean;
  // Actions
  setSelectedImage: (image: ImagePrompt | null) => void;
  setAllImages: (images: ImagePrompt[]) => void;
  setSearchQuery: (query: string) => void;
  setActiveCategory: (category: string) => void;
  setActiveTimeFilter: (filter: "all" | "today" | "week" | "month") => void;
  toggleFavorite: (imageId: string) => void;
  isFavorite: (imageId: string) => boolean;
  toggleShowFavoritesOnly: () => void;
  toggleTheme: () => void;
  // Auth actions
  setUser: (user: User | null) => void;
  fetchFavorites: () => Promise<void>;
  setShowLoginPrompt: (show: boolean) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  selectedImage: null,
  allImages: [],
  searchQuery: "",
  activeCategory: "all",
  activeTimeFilter: "all",
  favorites: [],
  showFavoritesOnly: false,
  theme: "light",
  // Auth
  user: null,
  favoritesLoaded: false,
  showLoginPrompt: false,

  setSelectedImage: (image) => set({ selectedImage: image }),
  setAllImages: (images) => set({ allImages: images }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setActiveCategory: (category) => set({ activeCategory: category }),
  setActiveTimeFilter: (filter) => set({ activeTimeFilter: filter }),
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

  toggleFavorite: (imageId) => {
    const { user, favorites } = get();
    const wasFavorite = favorites.includes(imageId);

    // Not logged in → show login prompt
    if (!user) {
      set({ showLoginPrompt: true });
      return;
    }

    // Optimistic update
    set({
      favorites: wasFavorite
        ? favorites.filter((id) => id !== imageId)
        : [...favorites, imageId],
    });

    // Sync to Supabase (fire-and-forget, rollback on error)
    const supabase = createClient();
    if (wasFavorite) {
      supabase
        .from("favorites")
        .delete()
        .eq("image_id", imageId)
        .eq("user_id", user.id)
        .then(({ error }) => {
          if (error) {
            set((s) => ({
              favorites: [...s.favorites, imageId],
            }));
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
}));
