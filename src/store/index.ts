import { create } from "zustand";
import type { ImagePrompt } from "@/lib/types";

interface AppState {
  selectedImage: ImagePrompt | null;
  allImages: ImagePrompt[];
  searchQuery: string;
  activeCategory: string;
  favorites: string[];
  showFavoritesOnly: boolean;
  setSelectedImage: (image: ImagePrompt | null) => void;
  setAllImages: (images: ImagePrompt[]) => void;
  setSearchQuery: (query: string) => void;
  setActiveCategory: (category: string) => void;
  toggleFavorite: (imageId: string) => void;
  isFavorite: (imageId: string) => boolean;
  toggleShowFavoritesOnly: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  selectedImage: null,
  allImages: [],
  searchQuery: "",
  activeCategory: "all",
  favorites: [],
  showFavoritesOnly: false,

  setSelectedImage: (image) => set({ selectedImage: image }),
  setAllImages: (images) => set({ allImages: images }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setActiveCategory: (category) => set({ activeCategory: category }),
  toggleShowFavoritesOnly: () =>
    set((state) => ({ showFavoritesOnly: !state.showFavoritesOnly })),

  toggleFavorite: (imageId) =>
    set((state) => ({
      favorites: state.favorites.includes(imageId)
        ? state.favorites.filter((id) => id !== imageId)
        : [...state.favorites, imageId],
    })),

  isFavorite: (imageId) => get().favorites.includes(imageId),
}));
