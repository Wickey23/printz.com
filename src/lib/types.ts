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
