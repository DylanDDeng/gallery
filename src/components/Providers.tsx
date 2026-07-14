"use client";

import AuthProvider from "./AuthProvider";
import LoginPrompt from "./LoginPrompt";

type InitialUser = {
  id: string;
  email?: string;
  phone?: string;
  phone_confirmed_at?: string;
  user_metadata?: {
    name?: string;
    avatar_url?: string;
    full_name?: string;
    picture?: string;
  };
} | null;

export default function Providers({
  children,
  initialUser,
  initialCredits,
}: {
  children: React.ReactNode;
  initialUser: InitialUser;
  initialCredits: number | null;
}) {
  return (
    <AuthProvider initialUser={initialUser} initialCredits={initialCredits}>
      {children}
      <LoginPrompt />
    </AuthProvider>
  );
}
