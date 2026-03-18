import type { Metadata } from "next";
import Script from "next/script";
import Providers from "@/components/Providers";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;600;700&display=swap"
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
      <body className="font-sans antialiased bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
        <Providers>{children}</Providers>
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
