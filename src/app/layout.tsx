import type { Metadata } from "next";
import Script from "next/script";
import Providers from "@/components/Providers";
import { isBillingEnabled } from "@/lib/billing-feature";
import { createClient as createServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.aestara.art"),
  title: "Aestara — AI Image Generation",
  description:
    "Generate AI images with credits, save your history, and manage purchases through Aestara.",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: "Aestara — AI Image Generation",
    description:
      "Generate AI images with credits, save your history, and manage purchases through Aestara.",
    images: ["/opengraph-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Aestara — AI Image Generation",
    description:
      "Generate AI images with credits, save your history, and manage purchases through Aestara.",
    images: ["/opengraph-image.png"],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let initialCredits: number | null = null;

  if (user && isBillingEnabled()) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("credits")
      .eq("id", user.id)
      .single();

    initialCredits = profile?.credits ?? 0;
  }

  const initialUser = user
    ? {
        id: user.id,
        email: user.email,
        user_metadata: {
          name: user.user_metadata?.name,
          avatar_url: user.user_metadata?.avatar_url,
          full_name: user.user_metadata?.full_name,
          picture: user.user_metadata?.picture,
        },
      }
    : null;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const theme = localStorage.getItem('theme');
                if (theme === 'dark') {
                  document.documentElement.classList.add('dark');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="font-sans antialiased bg-[#f5f2ed] dark:bg-[#0c0b09] text-[#2a2520] dark:text-[#c4bdb4]">
        <Providers initialUser={initialUser} initialCredits={initialCredits}>
          {children}
        </Providers>
        <Script
          defer
          src="https://cloud.umami.is/script.js"
          data-website-id="d6584f0c-286d-42d7-a9f4-ac20093c3865"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
