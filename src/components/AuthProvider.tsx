"use client";

import { useEffect, useState } from "react";
import { isBillingEnabled } from "@/lib/billing-feature";
import { createClient } from "@/lib/supabase-browser";
import { useAppStore } from "@/store";

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const setUser = useAppStore((s) => s.setUser);
  const fetchFavorites = useAppStore((s) => s.fetchFavorites);
  const fetchCredits = useAppStore((s) => s.fetchCredits);
  const [initialized, setInitialized] = useState(false);
  const billingEnabled = isBillingEnabled();

  useEffect(() => {
    const supabase = createClient();

    // Check for existing session on mount
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user as Parameters<typeof setUser>[0] | null);
      if (user) {
        fetchFavorites();
        if (billingEnabled) {
          void fetchCredits();
        }
      } else {
        useAppStore.setState({
          favorites: [],
          favoritesLoaded: true,
          credits: null,
        });
      }
      setInitialized(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      setUser(user as Parameters<typeof setUser>[0] | null);
      if (user) {
        fetchFavorites();
        if (billingEnabled) {
          void fetchCredits();
        }
      } else {
        useAppStore.setState({
          favorites: [],
          favoritesLoaded: true,
          credits: null,
        });
      }
    });

    return () => subscription.unsubscribe();
  }, [billingEnabled, setUser, fetchCredits, fetchFavorites]);

  // Prevent rendering until we've checked for an existing session
  // This prevents flash of unauthenticated state
  if (!initialized) {
    return null;
  }

  return <>{children}</>;
}
