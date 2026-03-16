import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export default async function OGImage(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const title = searchParams.get("title") || "Aestara";
  const description =
    searchParams.get("description") || "AI Image Gallery";

  const logoUrl = new URL("/logo.png", request.url).toString();

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#09090b",
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 40,
          }}
        >
          <img
            src={logoUrl}
            width={80}
            height={80}
            style={{
              borderRadius: 16,
            }}
          />
        </div>

        {/* Title */}
        <div
          style={{
            display: "flex",
            fontSize: 64,
            fontWeight: 700,
            color: "#ffffff",
            letterSpacing: "-0.02em",
          }}
        >
          {title}
        </div>

        {/* Divider */}
        <div
          style={{
            width: 80,
            height: 3,
            marginTop: 24,
            marginBottom: 24,
            borderRadius: 2,
            background: "#7c5cff",
          }}
        />

        {/* Description */}
        <div
          style={{
            display: "flex",
            fontSize: 28,
            color: "#a1a1aa",
            letterSpacing: "0.05em",
          }}
        >
          {description}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
