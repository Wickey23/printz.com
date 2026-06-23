import { cache } from "react";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { mockMedia, mockProducts, mockSuggestions } from "@/lib/mock-data";
import type { CustomPrintRequest, EtsyTrendReport, PrintableModel, PrintStockOption, Product, ProductMedia, Suggestion } from "@/lib/types";

export const getProducts = cache(async () => {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return mockProducts;

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (error) return mockProducts;
  return (data || []) as Product[];
});

export const getAllProductsForAdmin = cache(async () => {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return mockProducts;

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return mockProducts;
  return (data || []) as Product[];
});

export const getFeaturedProducts = cache(async () => {
  const products = await getProducts();
  return products.filter((product) => product.featured).slice(0, 6);
});

export const getProductBySlug = cache(async (slug: string) => {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return mockProducts.find((product) => product.slug === slug) || null;

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();

  if (error) return mockProducts.find((product) => product.slug === slug) || null;
  return data as Product | null;
});

export const getProductByIdForAdmin = cache(async (id: string) => {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return mockProducts.find((product) => product.id === id) || null;

  const { data, error } = await supabase.from("products").select("*").eq("id", id).maybeSingle();

  if (error) return null;
  return data as Product | null;
});

export const getProductMedia = cache(async (productId: string) => {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return mockMedia.filter((media) => media.product_id === productId);

  const { data, error } = await supabase
    .from("product_media")
    .select("*")
    .eq("product_id", productId)
    .order("sort_order", { ascending: true });

  if (error) return [] as ProductMedia[];
  return (data || []) as ProductMedia[];
});

export const getProductMediaForProducts = cache(async (productIds: string[]) => {
  const ids = Array.from(new Set(productIds)).filter(Boolean);
  if (!ids.length) return {} as Record<string, ProductMedia[]>;

  const supabase = createSupabaseAdminClient();
  const media = supabase
    ? await supabase
        .from("product_media")
        .select("*")
        .in("product_id", ids)
        .order("sort_order", { ascending: true })
    : { data: mockMedia.filter((item) => ids.includes(item.product_id)), error: null };

  if (media.error) return {} as Record<string, ProductMedia[]>;

  return ((media.data || []) as ProductMedia[]).reduce<Record<string, ProductMedia[]>>((groups, item) => {
    groups[item.product_id] = [...(groups[item.product_id] || []), item];
    return groups;
  }, {});
});

export const getSuggestionsForAdmin = cache(async () => {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return mockSuggestions;

  const { data, error } = await supabase
    .from("suggestions")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return [] as Suggestion[];
  return (data || []) as Suggestion[];
});

export const getEtsyTrendReportsForAdmin = cache(async () => {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return [] as EtsyTrendReport[];

  const { data, error } = await supabase
    .from("etsy_trend_reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return [] as EtsyTrendReport[];
  return (data || []) as EtsyTrendReport[];
});

export const getPrintRequestsForUser = cache(async () => {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [] as CustomPrintRequest[];
  const admin = createSupabaseAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return [] as CustomPrintRequest[];

  const { data, error } = await supabase
    .from("custom_print_requests")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const fallback = admin ? await getFallbackPrintRequests(admin, user.email) : [];
  if (error) return fallback;
  return mergePrintRequests((data || []) as CustomPrintRequest[], fallback);
});

export const getPrintRequestsForAdmin = cache(async () => {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return [] as CustomPrintRequest[];

  const { data, error } = await supabase
    .from("custom_print_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  const fallback = await getFallbackPrintRequests(supabase);
  if (error) return fallback;
  return mergePrintRequests((data || []) as CustomPrintRequest[], fallback);
});

export const getPrintStockOptions = cache(async ({ activeOnly = false }: { activeOnly?: boolean } = {}) => {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return defaultPrintStockOptions(activeOnly);

  let query = supabase
    .from("print_stock_options")
    .select("*")
    .order("option_type", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (activeOnly) query = query.eq("active", true);

  const { data, error } = await query;
  if (error) return defaultPrintStockOptions(activeOnly);
  return (data || []) as PrintStockOption[];
});

export const getPrintableModels = cache(async () => {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return fallbackPrintableModels();

  const { data, error } = await supabase
    .from("printable_models")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(60);

  if (error) return fallbackPrintableModels();
  return ((data || []) as PrintableModel[]).length ? (data || []) as PrintableModel[] : fallbackPrintableModels();
});

function fallbackPrintableModels(): PrintableModel[] {
  const now = new Date().toISOString();
  return [
    {
      title: "Modern ribbed desk organizer",
      source_platform: "MakerWorld",
      source_url: "https://makerworld.com/en/models/783651-modern-desk-organizer-low-waste-no-ams-needed",
      category: "Desk organization",
      tags: ["desk", "organizer", "office", "teacher"],
      license_summary: "Source model must be checked before commercial printing.",
      print_notes: "Good starter request for office, teacher desk, and study setups.",
    },
    {
      title: "Parametric organizer box",
      source_platform: "MakerWorld",
      source_url: "https://makerworld.com/en/models/1660223-parametric-desk-organizer-fully-customizable",
      category: "Storage",
      tags: ["parametric", "box", "storage", "organizer"],
      license_summary: "Confirm source license and customer-selected dimensions before quote.",
      print_notes: "Useful for custom sizes and classroom supply storage.",
    },
    {
      title: "Hydro flask cup holder adapter",
      source_platform: "Printables",
      source_url: "https://www.printables.com/model/120213-hydro-flask-cup-holder-adapter",
      category: "Adapters",
      tags: ["adapter", "cup holder", "replacement", "utility"],
      license_summary: "Confirm source license before printing for resale or third-party customers.",
      print_notes: "Ask customer for bottle and cup-holder measurements.",
    },
    {
      title: "Customizable name desk organizer",
      source_platform: "MakerWorld",
      source_url: "https://makerworld.com/en/models/2600234-customizable-name-desk-organizer",
      category: "Personalized gifts",
      tags: ["name", "teacher gift", "desk", "personalized"],
      license_summary: "Personalization and source license must be reviewed before quote.",
      print_notes: "Strong request candidate for teacher gifts and office name plates.",
    },
  ].map((model, index) => ({
    id: `fallback-printable-${index + 1}`,
    image_url: null,
    active: true,
    sort_order: index,
    created_at: now,
    updated_at: now,
    ...model,
  }));
}

function defaultPrintStockOptions(activeOnly: boolean) {
  const now = new Date().toISOString();
  const options: PrintStockOption[] = [
    ["material", "PLA", "PLA", null],
    ["material", "PETG", "PETG", null],
    ["material", "TPU", "TPU", null],
    ["color", "Black", "Black", "#111111"],
    ["color", "White", "White", "#f4f4f5"],
    ["color", "Gray", "Gray", "#71717a"],
    ["color", "Red", "Red", "#ef4444"],
    ["color", "Blue", "Blue", "#3b82f6"],
    ["color", "Green", "Green", "#22c55e"],
    ["finish", "Standard", "Standard", null],
    ["finish", "Matte", "Matte", null],
    ["finish", "Silk", "Silk", null],
  ].map(([optionType, name, value, hexColor], index) => ({
    id: `${optionType}-${value}`.toLowerCase(),
    option_type: optionType as PrintStockOption["option_type"],
    name: String(name),
    value: String(value),
    hex_color: hexColor ? String(hexColor) : null,
    active: true,
    sort_order: index,
    created_at: now,
    updated_at: now,
  }));

  return activeOnly ? options.filter((option) => option.active) : options;
}

async function getFallbackPrintRequests(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  email?: string,
) {
  let query = supabase
    .from("suggestions")
    .select("*")
    .eq("category", "Custom Print Request")
    .order("created_at", { ascending: false })
    .limit(100);

  if (email) query = query.eq("email", email);

  const { data, error } = await query;
  if (error) return [] as CustomPrintRequest[];

  return ((data || []) as Suggestion[])
    .map(suggestionToPrintRequest)
    .filter((request): request is CustomPrintRequest => Boolean(request));
}

function mergePrintRequests(primary: CustomPrintRequest[], fallback: CustomPrintRequest[]) {
  const seen = new Set(primary.map((request) => request.id));
  return [...primary, ...fallback.filter((request) => !seen.has(request.id))].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

function suggestionToPrintRequest(suggestion: Suggestion): CustomPrintRequest | null {
  const prefix = "CUSTOM_PRINT_REQUEST_JSON:";
  if (!suggestion.description?.startsWith(prefix)) return null;

  try {
    const payload = JSON.parse(suggestion.description.slice(prefix.length)) as Partial<CustomPrintRequest>;
    const title = asString(payload.title) || suggestion.title.replace(/^\[Custom Print\]\s*/, "");
    const createdAt = suggestion.created_at || new Date().toISOString();

    return {
      id: `suggestion:${suggestion.id}`,
      user_id: asString(payload.user_id),
      customer_email: suggestion.email || asString(payload.customer_email),
      title,
      notes: nullableString(payload.notes),
      material: asString(payload.material) || "PLA",
      color: asString(payload.color) || "Black",
      finish: asString(payload.finish) || "Standard",
      infill_percent: asNumber(payload.infill_percent, 15),
      quantity: asNumber(payload.quantity, 1),
      estimated_grams: nullableNumber(payload.estimated_grams),
      estimated_hours: nullableNumber(payload.estimated_hours),
      shipping_name: asString(payload.shipping_name),
      shipping_address: asString(payload.shipping_address),
      model_source_url: nullableString(payload.model_source_url),
      model_source_platform: nullableString(payload.model_source_platform),
      file_urls: asStringArray(payload.file_urls),
      file_names: asStringArray(payload.file_names),
      image_urls: asStringArray(payload.image_urls),
      estimate_cents: asNumber(payload.estimate_cents, 0),
      quoted_cents: nullableNumber(payload.quoted_cents),
      etsy_checkout_url: nullableString(payload.etsy_checkout_url),
      payment_status: asPaymentStatus(payload.payment_status),
      production_status: asProductionStatus(payload.production_status),
      created_at: createdAt,
      updated_at: asString(payload.updated_at) || createdAt,
    };
  } catch {
    return null;
  }
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function nullableString(value: unknown) {
  return typeof value === "string" && value.length ? value : null;
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function asNumber(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nullableNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function asPaymentStatus(value: unknown): CustomPrintRequest["payment_status"] {
  const status = asString(value);
  return ["quote_pending", "checkout_pending", "paid", "canceled", "refunded"].includes(status)
    ? (status as CustomPrintRequest["payment_status"])
    : "quote_pending";
}

function asProductionStatus(value: unknown): CustomPrintRequest["production_status"] {
  const status = asString(value);
  return ["new", "reviewing", "ready_to_print", "printing", "shipped", "completed", "rejected"].includes(status)
    ? (status as CustomPrintRequest["production_status"])
    : "new";
}
