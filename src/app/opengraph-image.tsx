import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export default async function OGImage(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const title = searchParams.get("title") || "Aestara";
  const description =
    searchParams.get("description") || "AI Image Gallery";

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
          backgroundImage:
            "radial-gradient(circle at 25% 50%, rgba(120, 80, 255, 0.15) 0%, transparent 50%), radial-gradient(circle at 75% 50%, rgba(255, 100, 150, 0.1) 0%, transparent 50%)",
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
            src={`${new URL("/logo.png", request.url).toString()}`}
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
            background: "linear-gradient(90deg, #7c5cff, #ff6496)",
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
