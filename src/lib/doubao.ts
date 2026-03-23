// Doubao (Seedream) API Client
// Base URL for Doubao API

const DOUBAO_API_ENDPOINT = "https://ark.cn-beijing.volces.com/api/v3/images/generations";

export interface DoubaoGenerateParams {
  apiKey: string;
  prompt: string;
  model?: string;
  size?: string;
  image?: string;
  outputFormat?: "png" | "jpeg" | "webp";
  watermark?: boolean;
}

export interface DoubaoGenerateResponse {
  data: {
    url: string;
    revised_prompt?: string;
  }[];
  created: number;
}

export class DoubaoClient {
  private endpoint: string;

  constructor(endpoint?: string) {
    this.endpoint = endpoint || DOUBAO_API_ENDPOINT;
  }

  private get headers() {
    return {
      "Content-Type": "application/json",
    };
  }

  /**
   * Generate an image using Doubao Seedream
   */
  async generate(params: DoubaoGenerateParams): Promise<DoubaoGenerateResponse> {
    const image = params.image?.trim();
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        ...this.headers,
        "Authorization": `Bearer ${params.apiKey}`,
      },
      body: JSON.stringify({
        model: params.model || "doubao-seedream-5-0-260128",
        prompt: params.prompt,
        ...(image ? { image } : {}),
        output_format: params.outputFormat || "png",
        sequential_image_generation: "disabled",
        response_format: "url",
        size: params.size || "2K",
        stream: false,
        watermark: params.watermark ?? false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Doubao API error: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message;
        }
      } catch {
        // Use default error message
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }
}

// Singleton instance
export const doubaoClient = new DoubaoClient();
