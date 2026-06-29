export type Product = {
  id: string;
  name: string;
  slug: string;
  short_description: string;
  full_description: string | null;
  category: string;
  price: number | null;
  etsy_url: string | null;
  main_image_url: string | null;
  video_url: string | null;
  materials: string | null;
  dimensions: string | null;
  customization_notes: string | null;
  personalization_enabled?: boolean;
  personalization_prompt?: string | null;
  color_options?: string[] | null;
  size_options?: string[] | null;
  finish_options?: string[] | null;
  processing_time?: string | null;
  care_instructions?: string | null;
  source_url?: string | null;
  license_notes?: string | null;
  etsy_listing_id?: number | null;
  etsy_state?: string | null;
  synced_from_etsy_at?: string | null;
  workflow_status?: string | null;
  sheet_row_id?: string | null;
  sync_version?: number | null;
  sheet_synced_at?: string | null;
  last_sync_source?: string | null;
  archived_at?: string | null;
  source_platform?: string | null;
  creator_name?: string | null;
  license_type?: string | null;
  license_url?: string | null;
  commercial_sale_allowed?: boolean | null;
  modification_allowed?: boolean | null;
  attribution_required?: boolean | null;
  share_alike_required?: boolean | null;
  attribution_text?: string | null;
  trademark_review_status?: string | null;
  rights_status?: string | null;
  media_status?: string | null;
  drive_media_folder_url?: string | null;
  pricing_status?: string | null;
  estimated_cost?: number | null;
  suggested_price?: number | null;
  sales_likelihood_score?: number | null;
  sales_likelihood_notes?: string | null;
  tags: string[] | null;
  featured: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type ProductMedia = {
  id: string;
  product_id: string;
  media_type: "image" | "video";
  url: string;
  sort_order: number;
  created_at: string;
};

export type Suggestion = {
  id: string;
  name: string;
  email: string;
  title: string;
  description: string;
  category: string;
  reference_link: string | null;
  budget_range: string | null;
  status: "New" | "Reviewing" | "In Progress" | "Made" | "Rejected";
  created_at: string;
};

export type ContactMessage = {
  id: string;
  name: string;
  email: string;
  message: string;
  created_at: string;
};

export type EtsyTrendRecommendedListing = {
  title?: string;
  product_type?: "Digital" | "3D Printed" | "Hybrid" | string;
  price?: string;
  category?: string;
  tags?: string[];
  description?: string;
  files_or_variants?: string;
  photo_plan?: string;
  next_steps?: string;
};

export type EtsyTrendReport = {
  id: string;
  report_date: string;
  title: string;
  summary: string;
  top_trends: string[];
  listing_ideas: string[];
  recommended_listing: EtsyTrendRecommendedListing;
  source_notes: string | null;
  created_at: string;
};

export type CustomPrintRequest = {
  id: string;
  user_id: string;
  customer_email: string;
  title: string;
  notes: string | null;
  material: string;
  color: string;
  finish: string;
  infill_percent: number;
  quantity: number;
  estimated_grams: number | null;
  estimated_hours: number | null;
  shipping_name: string;
  shipping_address: string;
  model_source_url?: string | null;
  model_source_platform?: string | null;
  file_urls: string[];
  file_names: string[];
  image_urls: string[];
  estimate_cents: number;
  quoted_cents?: number | null;
  etsy_checkout_url?: string | null;
  payment_status: "quote_pending" | "checkout_pending" | "paid" | "canceled" | "refunded";
  production_status: "new" | "reviewing" | "ready_to_print" | "printing" | "shipped" | "completed" | "rejected";
  created_at: string;
  updated_at: string;
};

export type PrintStockOption = {
  id: string;
  option_type: "material" | "color" | "finish";
  name: string;
  value: string;
  hex_color: string | null;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type PrintableModel = {
  id: string;
  title: string;
  source_platform: string;
  source_url: string;
  image_url: string | null;
  category: string | null;
  tags: string[] | null;
  license_summary: string | null;
  print_notes: string | null;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ProductSyncRun = {
  id: string;
  run_id: string;
  product_id: string | null;
  sheet_name: string | null;
  sheet_row: number | null;
  operation: string;
  status: string;
  attempt: number;
  error: string | null;
  started_at: string;
  finished_at: string | null;
};

export type ProductSyncDeadLetter = {
  id: string;
  product_id: string | null;
  sheet_name: string | null;
  sheet_row: number | null;
  error: string;
  attempts: number;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProductSyncHealth = {
  configured: {
    supabase: boolean;
    google: boolean;
    secret: boolean;
    sheetId: boolean;
  };
  migrationReady: boolean;
  lastRun: ProductSyncRun | null;
  latestRunCounts: Record<string, number>;
  recentRuns: ProductSyncRun[];
  recentErrors: ProductSyncRun[];
  deadLetters: ProductSyncDeadLetter[];
};
