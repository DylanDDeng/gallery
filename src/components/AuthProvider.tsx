"use client";

import { useEffect, useRef } from "react";
import { isBillingEnabled } from "@/lib/billing-feature";
import { createClient } from "@/lib/supabase-browser";
import { useAppStore } from "@/store";

type InitialUser = {
  id: string;
  email?: string;
  user_metadata?: {
    name?: string;
    avatar_url?: string;
    full_name?: string;
    picture?: string;
  };
} | null;

export default function AuthProvider({
  children,
  initialUser,
  initialCredits,
}: {
  children: React.ReactNode;
  initialUser: InitialUser;
  initialCredits: number | null;
}) {
  const setUser = useAppStore((s) => s.setUser);
  const setAuthInitialized = useAppStore((s) => s.setAuthInitialized);
  const fetchFavorites = useAppStore((s) => s.fetchFavorites);
  const fetchCredits = useAppStore((s) => s.fetchCredits);
  const billingEnabled = isBillingEnabled();
  const bootstrappedRef = useRef(false);

  if (!bootstrappedRef.current) {
    useAppStore.setState((state) => ({
      user: initialUser,
      authInitialized: true,
      credits: billingEnabled ? initialCredits : null,
      favoritesLoaded: initialUser ? state.favoritesLoaded : true,
      favorites: initialUser ? state.favorites : [],
    }));
    bootstrappedRef.current = true;
  }

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    // Check for existing session on mount
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled) return;
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
      setAuthInitialized(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
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
      setAuthInitialized(true);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [billingEnabled, setAuthInitialized, setUser, fetchCredits, fetchFavorites]);

  return <>{children}</>;
}
