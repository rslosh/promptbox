export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      image_assets: {
        Row: {
          id: string;
          storage_path: string;
          hash_sha256: string;
          source_type: "upload" | "gallery_dl";
          source_ref: string | null;
          width: number;
          height: number;
          format: string;
          media_type: "image" | "video";
          duration_seconds: number | null;
          poster_path: string | null;
          name: string | null;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          storage_path: string;
          hash_sha256: string;
          source_type: "upload" | "gallery_dl";
          source_ref?: string | null;
          width: number;
          height: number;
          format: string;
          media_type?: "image" | "video";
          duration_seconds?: number | null;
          poster_path?: string | null;
          name?: string | null;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          storage_path?: string;
          hash_sha256?: string;
          source_type?: "upload" | "gallery_dl";
          source_ref?: string | null;
          width?: number;
          height?: number;
          format?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      asset_tags: {
        Row: {
          id: string;
          asset_id: string;
          tag: string;
          confidence: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          asset_id: string;
          tag: string;
          confidence?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          asset_id?: string;
          tag?: string;
          confidence?: number | null;
          created_at?: string;
        };
      };
      prompts: {
        Row: {
          id: string;
          asset_id: string;
          json_prompt: Json;
          natural_prompt: string;
          scene_prompt: Json;
          model_name: string;
          model_params: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          asset_id: string;
          json_prompt: Json;
          natural_prompt: string;
          scene_prompt?: Json;
          model_name: string;
          model_params?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          asset_id?: string;
          json_prompt?: Json;
          natural_prompt?: string;
          scene_prompt?: Json;
          model_name?: string;
          model_params?: Json;
          created_at?: string;
        };
      };
      prompt_versions: {
        Row: {
          id: string;
          prompt_id: string;
          version_index: number;
          json_prompt: Json;
          natural_prompt: string;
          scene_prompt: Json;
          edit_source: "manual" | "llm" | "voice";
          created_at: string;
        };
        Insert: {
          id?: string;
          prompt_id: string;
          version_index: number;
          json_prompt: Json;
          natural_prompt: string;
          scene_prompt?: Json;
          edit_source: "manual" | "llm" | "voice";
          created_at?: string;
        };
        Update: {
          id?: string;
          prompt_id?: string;
          version_index?: number;
          json_prompt?: Json;
          natural_prompt?: string;
          scene_prompt?: Json;
          edit_source?: "manual" | "llm" | "voice";
          created_at?: string;
        };
      };
      ingestion_jobs: {
        Row: {
          id: string;
          status: "queued" | "running" | "failed" | "completed";
          source_type: string;
          source_ref: string;
          error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          status?: "queued" | "running" | "failed" | "completed";
          source_type: string;
          source_ref: string;
          error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          status?: "queued" | "running" | "failed" | "completed";
          source_type?: string;
          source_ref?: string;
          error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      playground_remixes: {
        Row: {
          id: string;
          name: string | null;
          image_ids: string[];
          prompt_components: Json;
          edit_instructions: string;
          generated_prompt: string;
          history: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name?: string | null;
          image_ids: string[];
          prompt_components?: Json;
          edit_instructions?: string;
          generated_prompt?: string;
          history?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string | null;
          image_ids?: string[];
          prompt_components?: Json;
          edit_instructions?: string;
          generated_prompt?: string;
          history?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      prompt_library: {
        Row: {
          id: string;
          title: string;
          content: string;
          type: "image_gen" | "image_edit" | "video_gen";
          source: "manual" | "playground_node";
          source_url: string | null;
          source_image_ids: string[];
          output_image_id: string | null;
          is_favorite: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          content: string;
          type: "image_gen" | "image_edit" | "video_gen";
          source?: "manual" | "playground_node";
          source_url?: string | null;
          source_image_ids?: string[];
          output_image_id?: string | null;
          is_favorite?: boolean;
        };
        Update: {
          title?: string;
          content?: string;
          type?: "image_gen" | "image_edit" | "video_gen";
          source_url?: string | null;
          source_image_ids?: string[];
          output_image_id?: string | null;
          is_favorite?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      collections: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          platform: "pinterest" | "are_na" | "tumblr" | "manual" | "cosmos" | "shotdeck" | "midjourney";
          source_url: string | null;
          cover_image_url: string | null;
          last_synced_at: string | null;
          sync_cursor: string | null;
          image_count: number;
          remote_count: number | null;
          remote_count_checked_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          platform: "pinterest" | "are_na" | "tumblr" | "manual" | "cosmos" | "shotdeck" | "midjourney";
          source_url?: string | null;
          cover_image_url?: string | null;
          last_synced_at?: string | null;
          sync_cursor?: string | null;
          image_count?: number;
          remote_count?: number | null;
          remote_count_checked_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          platform?: "pinterest" | "are_na" | "tumblr" | "manual" | "cosmos" | "shotdeck" | "midjourney";
          source_url?: string | null;
          cover_image_url?: string | null;
          last_synced_at?: string | null;
          sync_cursor?: string | null;
          image_count?: number;
          remote_count?: number | null;
          remote_count_checked_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      collection_assets: {
        Row: {
          id: string;
          collection_id: string;
          asset_id: string;
          position: number;
          source_item_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          collection_id: string;
          asset_id: string;
          position?: number;
          source_item_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          collection_id?: string;
          asset_id?: string;
          position?: number;
          source_item_id?: string | null;
          created_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

// Convenience types
export type ImageAsset = Database["public"]["Tables"]["image_assets"]["Row"];
export type AssetTag = Database["public"]["Tables"]["asset_tags"]["Row"];
export type Prompt = Database["public"]["Tables"]["prompts"]["Row"];
export type PromptVersion = Database["public"]["Tables"]["prompt_versions"]["Row"];
export type IngestionJob = Database["public"]["Tables"]["ingestion_jobs"]["Row"];
export type PlaygroundRemix = Database["public"]["Tables"]["playground_remixes"]["Row"];
export type Collection = Database["public"]["Tables"]["collections"]["Row"];
export type CollectionAsset = Database["public"]["Tables"]["collection_assets"]["Row"];
export type PromptLibrary = Database["public"]["Tables"]["prompt_library"]["Row"];

// Prompt component type for playground
export interface PromptComponent {
  id: string;
  type: string;
  value: string;
  imageIndex: number;
  imageId: string;
}
