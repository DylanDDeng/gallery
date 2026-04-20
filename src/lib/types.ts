export interface ImagePrompt {
  id: string;
  url: string;
  prompt?: string; // JSON string of the detailed prompt
  prompt_zh?: string | null;
  prompt_ja?: string | null;
  author: string;
  model: string;
  category: string;
  tags: string[];
  width: number | null;
  height: number | null;
  created_at: string;
  tweet_url?: string | null;
}

export interface Favorite {
  id: string;
  image_id: string;
  user_id: string;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  count?: number;
}

export interface UserProfile {
  id: string;
  email?: string;
  name?: string;
  avatar_url?: string;
}
