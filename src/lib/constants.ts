// For local development without Supabase, we use mock data
import type { ImagePrompt } from "./types";

export const MOCK_IMAGES: ImagePrompt[] = [
  {
    id: "1",
    url: "https://image-1325800846.cos.ap-nanjing.myqcloud.com/20260124150650845.png",
    prompt: JSON.stringify({
      image_description: {
        scene: {
          location: {
            city: "Rome",
            setting: "Interior of a luxurious, dimly lit Roman hotel suite",
            details:
              "The room is shadowy. Large French doors are flung open to the balcony. The bed is unmade with messy, plush white linens.",
          },
          environment: {
            elements: [
              "Rumpled white bed sheets",
              "Dark wooden headboard",
              "A shaft of blinding sunlight cutting through the darkness",
              "Dust motes dancing in the light beam",
            ],
            atmosphere:
              "Intimate, voyeuristic, cinematic, but capturing a candid, unguarded moment.",
          },
          lighting: {
            type: "Hard Beam of Sunlight (Chiaroscuro)",
            effect:
              "A single, powerful shaft of natural light pours in, illuminating the subject on the bed. The light hits her face and upper body directly, highlighting the realistic texture of her skin while leaving the background in deep darkness.",
          },
        },
        subject: {
          identity: "Ana de Armas",
          pose: {
            description:
              "She is kneeling on the soft mattress, sinking slightly into the plush surface. Her body is turned towards the light source, face looking directly into the camera. Her back is slightly arched, one hand running through her hair, the other resting on her thigh.",
          },
          outfit: {
            top: {
              type: "Structured corset-style top",
              color: "Dark red",
              style:
                "The structured bodice contrasts with the soft chaos of the bedsheets. The deep red color pops vividly against the white linens.",
            },
            bottom: {
              type: "High-waisted skirt",
              details:
                "The long skirt is spread out around her on the bed. The high slit reveals one leg, highlighting the skin texture in the sunlight.",
            },
          },
          hair_and_makeup: {
            hair: {
              style: "Natural, soft morning hair",
              details:
                "Loose, soft waves that look touchable and clean, not messy or greasy. The sunlight catches the golden tones in her brown hair, creating a halo effect.",
            },
            makeup: {
              style: "Hyper-realistic 'No-Makeup' look",
              details:
                "Extremely natural and fresh. No heavy contouring, no dark eyeshadow. Focus on authentic skin texture: visible pores, natural skin flush, and a healthy glow. Lips are a natural rosy shade with a slight hydration sheen, looking soft and bitten. The look is effortless and clean.",
            },
          },
        },
        composition: {
          aspect_ratio: "3:4",
          orientation: "Vertical",
          medium: "Analog Film Photography (Kodak Portra 400)",
          texture:
            "Fine film grain (less gritty than before), high resolution realism. The focus is razor-sharp on the eyes and skin texture, capturing the reality of the moment.",
          focus: {
            subject:
              "Sharp focus on the face to showcase the realistic skin details.",
            background: "Creamy, dark bokeh background.",
          },
        },
        mood_and_theme: {
          style: "Authentic Portraiture / Cinematic Realism",
          emotion:
            "Pure, unguarded, sensual, and human. The feeling of waking up in a beautiful place.",
        },
      },
    }),
    author: "BubbleBrain",
    model: "Nano Banana Pro",
    category: "portrait",
    tags: ["portrait", "cinematic", "film", "chiaroscuro", "Rome"],
    width: 768,
    height: 1024,
    created_at: "2026-01-24T15:06:00Z",
  },
  {
    id: "2",
    url: "https://image-1325800846.cos.ap-nanjing.myqcloud.com/20260124144930362.png",
    prompt: JSON.stringify({
      image_description: {
        scene: {
          location: { city: "Tokyo", setting: "Rainy neon-lit street" },
          environment: {
            atmosphere: "Cyberpunk, moody, atmospheric",
          },
        },
        subject: { identity: "Unknown" },
        composition: {
          aspect_ratio: "16:9",
          medium: "Digital Photography",
        },
        mood_and_theme: { style: "Cyberpunk", emotion: "Mysterious" },
      },
    }),
    author: "BubbleBrain",
    model: "Nano Banana Pro",
    category: "landscape",
    tags: ["cyberpunk", "tokyo", "neon", "rain"],
    width: 1024,
    height: 768,
    created_at: "2026-01-25T10:00:00Z",
  },
  {
    id: "3",
    url: "https://image-1325800846.cos.ap-nanjing.myqcloud.com/20260124145344835.png",
    prompt: JSON.stringify({
      image_description: {
        scene: {
          location: { city: "Paris", setting: "Café terrace at sunset" },
          environment: { atmosphere: "Warm, romantic, golden hour" },
        },
        subject: { identity: "Unknown" },
        composition: {
          aspect_ratio: "1:1",
          medium: "35mm Film",
        },
        mood_and_theme: { style: "Street Photography", emotion: "Nostalgic" },
      },
    }),
    author: "BubbleBrain",
    model: "Flux Pro",
    category: "street",
    tags: ["paris", "cafe", "sunset", "film", "street"],
    width: 800,
    height: 800,
    created_at: "2026-02-01T14:30:00Z",
  },
  {
    id: "4",
    url: "https://image-1325800846.cos.ap-nanjing.myqcloud.com/20260124144930362.png",
    prompt: JSON.stringify({
      image_description: {
        scene: {
          location: { city: "New York", setting: "Rooftop at night" },
          environment: { atmosphere: "Urban, energetic, night" },
        },
        subject: { identity: "Unknown" },
        composition: {
          aspect_ratio: "3:4",
          medium: "Digital",
        },
        mood_and_theme: { style: "Urban", emotion: "Energetic" },
      },
    }),
    author: "BubbleBrain",
    model: "Midjourney v6",
    category: "urban",
    tags: ["newyork", "rooftop", "night", "urban"],
    width: 768,
    height: 1024,
    created_at: "2026-02-05T20:00:00Z",
  },
  {
    id: "5",
    url: "https://image-1325800846.cos.ap-nanjing.myqcloud.com/20260124150650845.png",
    prompt: JSON.stringify({
      image_description: {
        scene: {
          location: {
            city: "Venice",
            setting: "Canal with gondolas at dawn",
          },
          environment: { atmosphere: "Serene, misty, ethereal" },
        },
        subject: { identity: "Unknown" },
        composition: {
          aspect_ratio: "16:9",
          medium: "Medium Format Film",
        },
        mood_and_theme: {
          style: "Fine Art",
          emotion: "Peaceful, timeless",
        },
      },
    }),
    author: "BubbleBrain",
    model: "SDXL",
    category: "landscape",
    tags: ["venice", "canal", "dawn", "fine-art"],
    width: 1200,
    height: 675,
    created_at: "2026-02-10T06:00:00Z",
  },
  {
    id: "6",
    url: "https://image-1325800846.cos.ap-nanjing.myqcloud.com/20260124145344835.png",
    prompt: JSON.stringify({
      image_description: {
        scene: {
          location: { city: "Kyoto", setting: "Bamboo forest path" },
          environment: { atmosphere: "Zen, tranquil, natural" },
        },
        subject: { identity: "Unknown" },
        composition: {
          aspect_ratio: "2:3",
          medium: "Large Format Film",
        },
        mood_and_theme: { style: "Nature", emotion: "Meditative" },
      },
    }),
    author: "BubbleBrain",
    model: "Flux Pro",
    category: "nature",
    tags: ["kyoto", "bamboo", "forest", "zen"],
    width: 675,
    height: 1000,
    created_at: "2026-02-15T08:00:00Z",
  },
  {
    id: "7",
    url: "https://image-1325800846.cos.ap-nanjing.myqcloud.com/20260124144930362.png",
    prompt: JSON.stringify({
      image_description: {
        scene: {
          location: { setting: "Dark minimal studio background fading into black" },
          environment: { atmosphere: "Moody, cinematic, high-end editorial" },
          lighting: {
            type: "Gentle diffused front light",
            effect: "Soft shadows, subtle film grain, organic color grading",
          },
        },
        subject: {
          identity: "Young woman",
          pose: { description: "Calm, self-assured expression" },
          outfit: {
            top: { type: "Fitted brown top", style: "Clean lines, understated elegance" },
          },
          hair_and_makeup: {
            hair: { style: "Loose dark brown hair", details: "Softly textured" },
            makeup: {
              style: "Barely-there natural makeup",
              details: "Clear fair skin, warm natural lips",
            },
          },
        },
        composition: {
          aspect_ratio: "3:4",
          orientation: "Vertical",
          medium: "Digital Photography",
          texture: "Subtle film grain, organic color grading",
          focus: {
            subject: "Sharp focus on face",
            background: "Shallow depth of field, fading into black",
          },
        },
        mood_and_theme: {
          style: "High-end editorial / Cinematic portrait",
          emotion: "Calm, self-assured, understated elegance",
        },
      },
    }),
    author: "@oggii_0",
    model: "Nano Banana Pro",
    category: "portrait",
    tags: ["portrait", "cinematic", "editorial", "moody", "film"],
    width: 768,
    height: 1024,
    created_at: "2026-02-20T14:49:00Z",
  },
  {
    id: "8",
    url: "https://image-1325800846.cos.ap-nanjing.myqcloud.com/20260124144930362.png",
    prompt: JSON.stringify({
      image_description: {
        scene: {
          location: { city: "London", setting: "Foggy cobblestone alley at dusk" },
          environment: { atmosphere: "Mysterious, nostalgic, atmospheric" },
          lighting: {
            type: "Warm tungsten street light",
            effect: "Glowing halos through fog, deep shadows",
          },
        },
        subject: { identity: "Unknown" },
        composition: {
          aspect_ratio: "4:5",
          medium: "35mm Film",
          texture: "Heavy film grain, rich blacks",
        },
        mood_and_theme: { style: "Street Photography", emotion: "Nostalgic, moody" },
      },
    }),
    author: "@oggii_0",
    model: "Nano Banana Pro",
    category: "cinematic",
    tags: ["london", "fog", "street", "film", "moody"],
    width: 720,
    height: 900,
    created_at: "2026-02-22T18:30:00Z",
  },
  {
    id: "9",
    url: "https://image-1325800846.cos.ap-nanjing.myqcloud.com/20260124145344835.png",
    prompt: JSON.stringify({
      image_description: {
        scene: {
          location: { city: "Hokkaido", setting: "Vast snow-covered birch forest" },
          environment: {
            atmosphere: "Airy, dreamlike, romantic winter",
            elements: ["Snow-laden birch trees", "Fresh snowfall", "Soft winter mist"],
          },
          lighting: {
            type: "Soft diffused winter daylight, slightly overexposed",
            effect: "Cool cyan and blue color grading, ethereal glow on skin",
          },
        },
        subject: {
          identity: "Ana de Armas",
          pose: {
            description:
              "Leaning languidly against a snow-laden tree trunk, looking directly into the camera with a sultry, intimate expression, lips slightly parted",
          },
          outfit: {
            top: { type: "Long dark brown faux-fur coat", style: "Luxurious, styled open" },
            bottom: {
              type: "Black silk slip dress",
              details: "Sleek, revealed under the open coat",
            },
            shoes: { type: "Tall leather boots" },
          },
          hair_and_makeup: {
            hair: { style: "Slightly wind-blown", details: "Natural, loose" },
            makeup: { style: "Natural, soft", details: "Sultry and intimate" },
          },
        },
        composition: {
          aspect_ratio: "3:4",
          orientation: "Vertical",
          medium: "35mm Film Photography",
          texture: "Grainy, visible film grain, rich analog feel",
          focus: {
            subject: "Sharp focus on face and expression",
            background: "Shallow depth of field, birch trees softly blurred",
          },
        },
        mood_and_theme: {
          style: "Cinematic Romanticism / Love Letter",
          emotion: "Intimate, sultry, nostalgic, wistful",
        },
      },
    }),
    author: "BubbleBrain",
    model: "Nano Banana Pro",
    category: "cinematic",
    tags: ["portrait", "film", "winter", "snow", "cinematic", "ana-de-armas", "hokkaido"],
    width: 768,
    height: 1024,
    created_at: "2026-02-28T14:53:00Z",
  },
];

export const CATEGORIES = [
  { name: "All", slug: "all" },
  { name: "Portrait", slug: "portrait" },
  { name: "Landscape", slug: "landscape" },
  { name: "Street", slug: "street" },
  { name: "Urban", slug: "urban" },
  { name: "Nature", slug: "nature" },
  { name: "Cinematic", slug: "cinematic" },
  { name: "Abstract", slug: "abstract" },
  { name: "3D", slug: "3d" },
  { name: "Product Photography", slug: "product-photography" },
  { name: "Conceptual Editorial Illustration", slug: "conceptual-editorial-illustration" },
  { name: "Poster", slug: "poster" },
  { name: "Sketchnote", slug: "sketchnote" },
  { name: "Character Design", slug: "character-design" },
  { name: "Knolling", slug: "knolling" },
] as const;

export const MODELS = [
  "Nano Banana Pro",
  "Nano Banana 2",
  "GPT Image 1.5",
  "Grok Imagine",
  "Seedream 4.5",
  "Seedream 5.0 Lite",
  "Z Image",
] as const;
