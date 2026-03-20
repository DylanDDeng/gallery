// Seedream API Client
// Note: API integration pending user providing Seedream API documentation

const SEEDREAM_API_KEY = process.env.SEEDDREAM_API_KEY;
const SEEDREAM_API_ENDPOINT = process.env.SEEDDREAM_API_ENDPOINT || "https://api.seedream.io/v1";

export interface SeedreamGenerateParams {
  prompt: string;
  model?: string;
  width?: number;
  height?: number;
  num_images?: number;
}

export interface SeedreamGenerateResponse {
  task_id: string;
  status: "queued" | "processing";
}

export interface SeedreamTaskStatus {
  task_id: string;
  status: "queued" | "processing" | "completed" | "failed";
  result_url?: string;
  error_message?: string;
  progress?: number;
}

export class SeedreamClient {
  private apiKey: string;
  private endpoint: string;

  constructor(apiKey?: string, endpoint?: string) {
    this.apiKey = apiKey || SEEDREAM_API_KEY || "";
    this.endpoint = endpoint || SEEDREAM_API_ENDPOINT;
  }

  private get headers() {
    return {
      "Authorization": `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * Submit a generation task to Seedream
   */
  async generate(params: SeedreamGenerateParams): Promise<SeedreamGenerateResponse> {
    const response = await fetch(`${this.endpoint}/generate`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        prompt: params.prompt,
        model: params.model || "doubao-seedream-5-0-260128",
        width: params.width || 1024,
        height: params.height || 1024,
        num_images: params.num_images || 1,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Seedream API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Check the status of a generation task
   */
  async getTaskStatus(taskId: string): Promise<SeedreamTaskStatus> {
    const response = await fetch(`${this.endpoint}/tasks/${taskId}`, {
      method: "GET",
      headers: this.headers,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Seedream API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Cancel a generation task
   */
  async cancelTask(taskId: string): Promise<void> {
    const response = await fetch(`${this.endpoint}/tasks/${taskId}/cancel`, {
      method: "POST",
      headers: this.headers,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Seedream API error: ${response.status} - ${error}`);
    }
  }
}

// Singleton instance
export const seedreamClient = new SeedreamClient();
