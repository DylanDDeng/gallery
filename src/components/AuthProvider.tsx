"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase-browser";
import { useAppStore } from "@/store";

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const setUser = useAppStore((s) => s.setUser);
  const fetchFavorites = useAppStore((s) => s.fetchFavorites);

  useEffect(() => {
    const supabase = createClient();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      setUser(user as Parameters<typeof setUser>[0] | null);
      if (user) {
        fetchFavorites();
      } else {
        useAppStore.setState({ favorites: [], favoritesLoaded: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [setUser, fetchFavorites]);

  return <>{children}</>;
}
