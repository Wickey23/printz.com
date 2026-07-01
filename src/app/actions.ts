"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { contactSchema, productSchema, suggestionSchema } from "@/lib/schemas";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { isApprovedAdmin } from "@/lib/auth";
import { categories, getAllowedAdminEmails } from "@/lib/config";
import { createEtsyDraftFromProduct, etsyDraftRequirements } from "@/lib/etsy-drafts";
import { createOrSyncEtsyListing, etsyListingRequirements } from "@/lib/etsy-listings";
import { getEtsyReadiness } from "@/lib/etsy-readiness";
import { getEffectiveEtsyRuntimeSettings, getValidEtsyOAuthToken, setEtsyRuntimeSettings } from "@/lib/etsy-auth";
import { syncEtsyListings } from "@/lib/etsy-sync";
import { importProductsCsvText } from "@/lib/product-import";
import { createOpenAiResponse, getOpenAiApiKeys, openAiKeyMissingMessage } from "@/lib/openai-response";
import type { EtsyTrendRecommendedListing, EtsyTrendReport, Product, ProductMedia } from "@/lib/types";
import { optionalTextFromForm, slugify, textFromForm } from "@/lib/utils";
import { runProductCommandSync, syncDriveMedia } from "../../scripts/lib/product-command-sync.mjs";
import { GoogleDriveClient } from "../../scripts/lib/google-drive-client.mjs";
import { GoogleSheetsClient } from "../../scripts/lib/google-sheets-client.mjs";

export type ActionState = {
  ok: boolean;
  message: string;
  errors?: Record<string, string[] | undefined>;
};

export type AiListingDraft = {
  name: string;
  slug: string;
  short_description: string;
  full_description: string;
  category: string;
  price: string;
  etsy_url: string;
  main_image_url: string;
  video_url: string;
  gallery_media_urls: string;
  materials: string;
  dimensions: string;
  customization_notes: string;
  personalization_enabled: boolean;
  personalization_prompt: string;
  color_options: string;
  size_options: string;
  finish_options: string;
  processing_time: string;
  care_instructions: string;
  source_url: string;
  license_notes: string;
  tags: string;
  featured: boolean;
  active: boolean;
};

export type AiListingState = ActionState & {
  draft?: AiListingDraft;
};

export type AiMarketResearchReport = {
  report_date: string;
  title: string;
  summary: string;
  top_trends: string[];
  listing_ideas: string[];
  recommended_listing: {
    title?: string;
    product_type?: string;
    price?: string;
    category?: string;
    tags?: string[];
    description?: string;
    files_or_variants?: string;
    photo_plan?: string;
    next_steps?: string;
  };
  source_notes: string;
};

export type AiMarketResearchState = ActionState & {
  report?: AiMarketResearchReport;
  productId?: string;
};

export type BulkOpportunityDraftState = ActionState & {
  created?: number;
  skipped?: number;
};

const bulkOpportunitySettingsCookie = "printz_bulk_opportunity_settings";

export type ProductResearchPipelineRow = {
  rowNumber: number;
  product: string;
  category: string;
  priority: string;
  status: string;
  opportunityScore: number | null;
  confidence: number | null;
  commercialUse: string;
  sourceQuality: string;
  modelLink: string;
  nextAction: string;
  selectionScore: number;
  canDraft: boolean;
  blockReason: string;
};

export type ProductResearchPipeline = {
  ok: boolean;
  message: string;
  spreadsheetInput: string;
  sheetName: string;
  totalRows: number;
  topOpportunities: ProductResearchPipelineRow[];
  licenseReviewQueue: ProductResearchPipelineRow[];
  readyToPrintQueue: ProductResearchPipelineRow[];
  draftReadyQueue: ProductResearchPipelineRow[];
};

export type EtsyDraftState = ActionState & {
  listingUrl?: string;
  uploadedImages?: number;
};

export type CustomPrintRequestState = ActionState;

export type AiScoutState = ActionState & {
  answer?: string;
  viabilityScore?: number;
  rightsRisk?: "Low" | "Medium" | "High" | string;
  rightsNotes?: string;
  sourcesToCheck?: string[];
  draft?: AiListingDraft;
};

const success = (message: string): ActionState => ({ ok: true, message });
const failure = (message: string, errors?: ActionState["errors"]): ActionState => ({
  ok: false,
  message,
  errors,
});

async function assertAdmin() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return false;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return isApprovedAdmin(user?.email);
}

export async function submitSuggestion(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = suggestionSchema.safeParse({
    name: textFromForm(formData, "name"),
    email: textFromForm(formData, "email"),
    title: textFromForm(formData, "title"),
    description: textFromForm(formData, "description"),
    category: textFromForm(formData, "category"),
    reference_link: optionalTextFromForm(formData, "reference_link"),
    budget_range: optionalTextFromForm(formData, "budget_range"),
  });

  if (!parsed.success) {
    return failure("Please fix the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return success("Suggestion captured locally. Add Supabase environment variables to persist it.");
  }

  const { error } = await supabase.from("suggestions").insert({
    ...parsed.data,
    status: "New",
  });

  if (error) return failure("Could not save your suggestion. Please try again.");
  return success("Thanks. Your idea was sent successfully.");
}

export async function submitContact(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = contactSchema.safeParse({
    name: textFromForm(formData, "name"),
    email: textFromForm(formData, "email"),
    message: textFromForm(formData, "message"),
  });

  if (!parsed.success) {
    return failure("Please fix the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return success("Message captured locally. Add Supabase environment variables to persist it.");
  }

  const { error } = await supabase.from("contact_messages").insert(parsed.data);
  if (error) return failure("Could not send your message. Please try again.");
  return success("Message sent. I will get back to you soon.");
}

export async function signInAdmin(_: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return failure("Supabase is not configured yet.");

  const email = textFromForm(formData, "email");
  const password = textFromForm(formData, "password");
  if (!email || !password) return failure("Email and password are required.");

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const message = error.message.includes("custom_print_requests") || error.code === "PGRST205"
      ? "The custom print request database table is not set up yet. Run supabase/custom_print_requests.sql in Supabase SQL Editor."
      : error.message;
    return failure(message);
  }

  redirect("/admin");
}

export async function signOutAdmin() {
  const supabase = await createSupabaseServerClient();
  await supabase?.auth.signOut();
  redirect("/admin/login");
}

export async function signInCustomer(_: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return failure("Supabase is not configured yet.");

  const email = textFromForm(formData, "email");
  const password = textFromForm(formData, "password");
  if (!email || !password) return failure("Email and password are required.");

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return failure(error.message);

  revalidatePath("/custom-print");
  return success("Signed in.");
}

export async function signUpCustomer(_: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return failure("Supabase is not configured yet.");

  const email = textFromForm(formData, "email");
  const password = textFromForm(formData, "password");
  if (!email || !password) return failure("Email and password are required.");
  if (password.length < 8) return failure("Password must be at least 8 characters.");

  const { error } = await supabase.auth.signUp({ email, password });
  if (error) return failure(error.message);

  revalidatePath("/custom-print");
  return success("Account created. If email confirmation is enabled, check your inbox before signing in.");
}

export async function signOutCustomer() {
  const supabase = await createSupabaseServerClient();
  await supabase?.auth.signOut();
  redirect("/custom-print");
}

export async function updateCustomerAccount(_: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return failure("Supabase is not configured yet.");

  const displayName = optionalTextFromForm(formData, "display_name");
  const avatarUrl = optionalTextFromForm(formData, "avatar_url");
  const phone = optionalTextFromForm(formData, "phone");
  const defaultShippingAddress = optionalTextFromForm(formData, "default_shipping_address");
  const emailNotifications = formData.get("email_notifications") === "on";
  const newPassword = optionalTextFromForm(formData, "new_password");

  const updates: {
    data: {
      display_name?: string | null;
      avatar_url?: string | null;
      phone?: string | null;
      default_shipping_address?: string | null;
      email_notifications?: boolean;
    };
    password?: string;
  } = {
    data: {
      display_name: displayName,
      avatar_url: avatarUrl,
      phone,
      default_shipping_address: defaultShippingAddress,
      email_notifications: emailNotifications,
    },
  };

  if (newPassword) {
    if (newPassword.length < 8) return failure("New password must be at least 8 characters.");
    updates.password = newPassword;
  }

  const { error } = await supabase.auth.updateUser(updates);
  if (error) return failure(error.message);

  revalidatePath("/account");
  return success("Account updated.");
}

export async function createCustomPrintRequest(
  _: CustomPrintRequestState,
  formData: FormData,
): Promise<CustomPrintRequestState> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return failure("Supabase is not configured yet.");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return failure("Sign in before uploading print files.");

  const title = textFromForm(formData, "title");
  const shippingName = textFromForm(formData, "shipping_name");
  const shippingAddress = textFromForm(formData, "shipping_address") || formatShippingAddress(formData);
  const fileUrls = formData.getAll("file_urls").map(String).filter(Boolean);
  const fileNames = formData.getAll("file_names").map(String).filter(Boolean);
  const imageUrls = formData.getAll("image_urls").map(String).filter(Boolean);
  const modelSourceUrl = optionalTextFromForm(formData, "model_source_url");
  const modelSourcePlatform = optionalTextFromForm(formData, "model_source_platform");
  const quantity = clampNumber(textFromForm(formData, "quantity"), 1, 100, 1);
  const estimatedGrams = optionalNumber(textFromForm(formData, "estimated_grams"));
  const estimatedHours = optionalNumber(textFromForm(formData, "estimated_hours"));
  const estimateCents = calculatePrintEstimateCents({ quantity, estimatedGrams, estimatedHours });

  if (!title || !shippingName || !shippingAddress) return failure("Project title, shipping name, and shipping address are required.");
  if (!fileUrls.length && !modelSourceUrl) return failure("Upload at least one 3D model file or paste a model source link before submitting.");

  const payload = {
    user_id: user.id,
    customer_email: user.email,
    title,
    notes: optionalTextFromForm(formData, "notes"),
    material: textFromForm(formData, "material") || "PLA",
    color: textFromForm(formData, "color") || "Black",
    finish: textFromForm(formData, "finish") || "Standard",
    infill_percent: clampNumber(textFromForm(formData, "infill_percent"), 0, 100, 15),
    quantity,
    estimated_grams: estimatedGrams,
    estimated_hours: estimatedHours,
    shipping_name: shippingName,
    shipping_address: shippingAddress,
    model_source_url: modelSourceUrl,
    model_source_platform: modelSourcePlatform,
    file_urls: fileUrls,
    file_names: fileNames.length ? fileNames : fileUrls,
    image_urls: imageUrls,
    estimate_cents: estimateCents,
    payment_status: "quote_pending",
    production_status: "new",
  };

  const { data, error } = await supabase
    .from("custom_print_requests")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    if (isMissingCustomPrintTableError(error)) {
      const adminSupabase = createSupabaseAdminClient();
      if (!adminSupabase) return failure("Supabase admin access is not configured for fallback print requests.");

      const fallback = await adminSupabase
        .from("suggestions")
        .insert({
          name: user.email,
          email: user.email,
          title: `[Custom Print] ${title}`,
          description: fallbackPrintRequestDescription(payload),
          category: "Custom Print Request",
          reference_link: null,
          budget_range: estimateCents ? `$${(estimateCents / 100).toFixed(2)} estimated` : "Quote pending",
          status: "New",
        })
        .select("id")
        .single();

      if (fallback.error) return failure(fallback.error.message);

      await sendPrintRequestEmail({
        id: `suggestion:${fallback.data.id}`,
        title,
        customerEmail: user.email,
        material: payload.material,
        color: payload.color,
        quantity,
        fileNames: payload.file_names,
        modelSourceUrl,
        modelSourcePlatform,
      });

      revalidatePath("/custom-print");
      revalidatePath("/admin/print-requests");
      revalidatePath("/admin");
      return success("Request uploaded. It was saved for admin review. We will create a custom Etsy checkout listing after checking the files.");
    }

    return failure(error.message);
  }

  await sendPrintRequestEmail({
    id: data.id,
    title,
    customerEmail: user.email,
    material: textFromForm(formData, "material") || "PLA",
    color: textFromForm(formData, "color") || "Black",
    quantity,
    fileNames: fileNames.length ? fileNames : fileUrls,
    modelSourceUrl,
    modelSourcePlatform,
  });

  revalidatePath("/custom-print");
  revalidatePath("/admin/print-requests");

  void data;
  return success("Request uploaded. We will review the model, create a custom Etsy checkout listing, and send the Etsy payment link before printing.");
}

export async function updateCustomPrintEtsyCheckout(formData: FormData) {
  if (!(await assertAdmin())) return;

  const id = textFromForm(formData, "id");
  const etsyCheckoutUrl = textFromForm(formData, "etsy_checkout_url");
  const quotedCents = dollarsToCents(textFromForm(formData, "quoted_price"));
  const paymentStatus = textFromForm(formData, "payment_status") || "quote_pending";
  const productionStatus = textFromForm(formData, "production_status") || "reviewing";

  const supabase = createSupabaseAdminClient();
  if (!id || !supabase) return;

  if (id.startsWith("suggestion:")) {
    const suggestionId = id.replace("suggestion:", "");
    const { data } = await supabase.from("suggestions").select("*").eq("id", suggestionId).maybeSingle();
    const payload = parseFallbackPrintRequestDescription(data?.description);

    if (data && payload) {
      const nextPayload = {
        ...payload,
        etsy_checkout_url: etsyCheckoutUrl || null,
        quoted_cents: quotedCents,
        payment_status: paymentStatus,
        production_status: productionStatus,
        updated_at: new Date().toISOString(),
      };

      await supabase
        .from("suggestions")
        .update({
          description: fallbackPrintRequestDescription(nextPayload),
          budget_range: quotedCents ? `$${(quotedCents / 100).toFixed(2)} quoted` : data.budget_range,
          status: productionStatus,
        })
        .eq("id", suggestionId);
    }

    revalidatePath("/custom-print");
    revalidatePath("/admin/print-requests");
    return;
  }

  await supabase
    .from("custom_print_requests")
    .update({
      etsy_checkout_url: etsyCheckoutUrl || null,
      quoted_cents: quotedCents,
      payment_status: paymentStatus,
      production_status: productionStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  revalidatePath("/custom-print");
  revalidatePath("/admin/print-requests");
}

export async function createPrintStockOption(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await assertAdmin())) return failure("Unauthorized.");

  const optionType = textFromForm(formData, "option_type");
  const name = textFromForm(formData, "name");
  const value = textFromForm(formData, "value") || name;
  const hexColor = optionalTextFromForm(formData, "hex_color");
  const sortOrder = clampNumber(textFromForm(formData, "sort_order"), 0, 9999, 0);

  if (!["material", "color", "finish"].includes(optionType)) return failure("Choose material, color, or finish.");
  if (!name) return failure("Option name is required.");

  const supabase = createSupabaseAdminClient();
  if (!supabase) return failure("Supabase service role key is required.");

  const { error } = await supabase.from("print_stock_options").insert({
    option_type: optionType,
    name,
    value,
    hex_color: optionType === "color" ? hexColor : null,
    active: formData.get("active") !== "off",
    sort_order: sortOrder,
  });

  if (error) return failure(error.message);

  revalidatePath("/custom-print");
  revalidatePath("/admin/print-options");
  return success("Stock option added.");
}

export async function updatePrintStockOption(formData: FormData) {
  if (!(await assertAdmin())) return;

  const id = textFromForm(formData, "id");
  const optionType = textFromForm(formData, "option_type");
  const name = textFromForm(formData, "name");
  const value = textFromForm(formData, "value") || name;
  const hexColor = optionalTextFromForm(formData, "hex_color");
  const sortOrder = clampNumber(textFromForm(formData, "sort_order"), 0, 9999, 0);
  const supabase = createSupabaseAdminClient();

  if (!id || !name || !supabase) return;

  await supabase
    .from("print_stock_options")
    .update({
      option_type: optionType,
      name,
      value,
      hex_color: optionType === "color" ? hexColor : null,
      active: formData.get("active") === "on",
      sort_order: sortOrder,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  revalidatePath("/custom-print");
  revalidatePath("/admin/print-options");
}

export async function deletePrintStockOption(formData: FormData) {
  if (!(await assertAdmin())) return;

  const id = textFromForm(formData, "id");
  const supabase = createSupabaseAdminClient();
  if (!id || !supabase) return;

  await supabase.from("print_stock_options").delete().eq("id", id);
  revalidatePath("/custom-print");
  revalidatePath("/admin/print-options");
}

function parseProductForm(formData: FormData) {
  const name = textFromForm(formData, "name");
  const parsed = productSchema.safeParse({
    name,
    slug: textFromForm(formData, "slug") || slugify(name),
    short_description: textFromForm(formData, "short_description"),
    full_description: textFromForm(formData, "full_description"),
    category: textFromForm(formData, "category"),
    price: textFromForm(formData, "price"),
    etsy_url: textFromForm(formData, "etsy_url"),
    main_image_url: textFromForm(formData, "main_image_url"),
    video_url: textFromForm(formData, "video_url"),
    drive_media_folder_url: textFromForm(formData, "drive_media_folder_url"),
    materials: textFromForm(formData, "materials"),
    dimensions: textFromForm(formData, "dimensions"),
    customization_notes: textFromForm(formData, "customization_notes"),
    personalization_enabled: formData.get("personalization_enabled") === "on",
    personalization_prompt: textFromForm(formData, "personalization_prompt"),
    color_options: textFromForm(formData, "color_options"),
    size_options: textFromForm(formData, "size_options"),
    finish_options: textFromForm(formData, "finish_options"),
    processing_time: textFromForm(formData, "processing_time"),
    care_instructions: textFromForm(formData, "care_instructions"),
    sales_likelihood_score: textFromForm(formData, "sales_likelihood_score"),
    sales_likelihood_notes: textFromForm(formData, "sales_likelihood_notes"),
    source_url: textFromForm(formData, "source_url"),
    license_notes: textFromForm(formData, "license_notes"),
    tags: textFromForm(formData, "tags"),
    featured: formData.get("featured") === "on",
    active: formData.get("active") === "on",
  });

  return parsed;
}

function isMissingSalesLikelihoodColumn(error: { message?: string; code?: string } | null) {
  return Boolean(error?.message?.includes("sales_likelihood_") || (error?.message?.includes("Could not find") && error.message.includes("products")));
}

function withoutSalesLikelihood<T extends Record<string, unknown>>(payload: T) {
  const { sales_likelihood_score: _score, sales_likelihood_notes: _notes, ...rest } = payload;
  void _score;
  void _notes;
  return rest;
}

function optionalNumber(value: string) {
  if (!value) return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function clampNumber(value: string, min: number, max: number, fallback: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function calculatePrintEstimateCents({
  quantity,
  estimatedGrams,
  estimatedHours,
}: {
  quantity: number;
  estimatedGrams: number | null;
  estimatedHours: number | null;
}) {
  if (!estimatedGrams || !estimatedHours) return 0;

  const setupCents = 500;
  const materialCents = Math.ceil(estimatedGrams * 14);
  const machineTimeCents = Math.ceil(estimatedHours * 250);
  const handlingCents = 599;
  return Math.max(999, (setupCents + materialCents + machineTimeCents) * quantity + handlingCents);
}

function dollarsToCents(value: string) {
  if (!value) return null;
  const parsed = Number(value.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100);
}

function formatShippingAddress(formData: FormData) {
  const street = textFromForm(formData, "shipping_street");
  const unit = optionalTextFromForm(formData, "shipping_unit");
  const city = textFromForm(formData, "shipping_city");
  const state = textFromForm(formData, "shipping_state").toUpperCase();
  const zip = textFromForm(formData, "shipping_zip");
  return [street, unit || "", `${city}, ${state} ${zip}`].map((part) => part.trim()).filter(Boolean).join("\n");
}

function isMissingCustomPrintTableError(error: { code?: string; message?: string }) {
  return error.code === "PGRST205" || Boolean(error.message?.includes("custom_print_requests"));
}

function fallbackPrintRequestDescription(payload: Record<string, unknown>) {
  return `CUSTOM_PRINT_REQUEST_JSON:${JSON.stringify(payload)}`;
}

function parseFallbackPrintRequestDescription(description?: string | null) {
  const prefix = "CUSTOM_PRINT_REQUEST_JSON:";
  if (!description?.startsWith(prefix)) return null;

  try {
    return JSON.parse(description.slice(prefix.length)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function syncProductMedia(
  productId: string,
  formData: FormData,
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
) {
  const urls = splitMediaUrls(textFromForm(formData, "gallery_media_urls"));

  await supabase.from("product_media").delete().eq("product_id", productId);
  if (!urls.length) return;

  await supabase.from("product_media").insert(
    urls.map((url, index) => ({
      product_id: productId,
      media_type: mediaTypeFromUrl(url),
      url,
      sort_order: index,
    })),
  );
}

function splitMediaUrls(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function mediaTypeFromUrl(url: string) {
  const clean = url.split("?")[0].toLowerCase();
  return clean.endsWith(".mp4") || clean.endsWith(".webm") || clean.endsWith(".mov") || clean.endsWith(".m4v")
    ? "video"
    : "image";
}

async function sendPrintRequestEmail({
  color,
  customerEmail,
  fileNames,
  id,
  material,
  modelSourcePlatform,
  modelSourceUrl,
  quantity,
  title,
}: {
  color: string;
  customerEmail: string;
  fileNames: string[];
  id: string;
  material: string;
  modelSourcePlatform?: string | null;
  modelSourceUrl?: string | null;
  quantity: number;
  title: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.PRINTZ_ADMIN_EMAIL || getAllowedAdminEmails()[0];
  if (!apiKey || !to) return;

  const adminUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "https://printzcom.vercel.app"}/admin/print-requests`;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.PRINTZ_EMAIL_FROM || "PRINTZ <onboarding@resend.dev>",
      to,
      subject: `New custom print request: ${title}`,
      text: [
        `New custom print request`,
        ``,
        `Project: ${title}`,
        `Customer: ${customerEmail}`,
        `Material: ${material}`,
        `Color: ${color}`,
        `Quantity: ${quantity}`,
        `Files: ${fileNames.length ? fileNames.join(", ") : "No upload yet"}`,
        modelSourceUrl ? `Source: ${modelSourcePlatform ? `${modelSourcePlatform} - ` : ""}${modelSourceUrl}` : "",
        `Request ID: ${id}`,
        ``,
        `Review it here: ${adminUrl}`,
      ].filter(Boolean).join("\n"),
    }),
  });
}


export async function runProductCommandCenterDryRun(state: ActionState): Promise<ActionState> {
  void state;
  if (!(await assertAdmin())) return failure("Unauthorized.");

  try {
    const result = await runProductCommandSync({ dryRun: true });
    const issueCount = result.blocked + result.conflicts + result.errors.length;
    const summary = [
      `Dry run complete: ${result.created} create, ${result.updated} update`,
      `${result.blocked} blocked`,
      `${result.conflicts} conflicts`,
      `${result.errors.length} system errors`,
    ].join("; ");

    return issueCount ? failure(summary) : success(summary);
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Product command-center dry run failed.");
  }
}

export async function runProductCommandCenterLiveSync(state: ActionState): Promise<ActionState> {
  void state;
  if (!(await assertAdmin())) return failure("Unauthorized.");

  try {
    const result = await runProductCommandSync({ dryRun: false });
    revalidatePath("/");
    revalidatePath("/products");
    revalidatePath("/admin");

    const issueCount = result.blocked + result.conflicts + result.errors.length;
    const summary = [
      `Live sync complete: ${result.created} created, ${result.updated} updated`,
      `${result.mediaUploads} media uploaded`,
      `${result.mediaSkipped || 0} media skipped`,
      `${result.blocked} blocked`,
      `${result.conflicts} conflicts`,
      `${result.errors.length} system errors`,
      "Site Products mirror refreshed",
    ].join("; ");

    return issueCount ? failure(summary) : success(summary);
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Product command-center live sync failed.");
  }
}
export async function createProduct(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await assertAdmin())) return failure("Unauthorized.");

  const parsed = parseProductForm(formData);
  if (!parsed.success) {
    return failure("Please fix the product fields.", parsed.error.flatten().fieldErrors);
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) return failure("Supabase service role key is required for admin product management.");

  let { data, error } = await supabase.from("products").insert(parsed.data).select("id").single();
  if (isMissingSalesLikelihoodColumn(error)) {
    ({ data, error } = await supabase.from("products").insert(withoutSalesLikelihood(parsed.data)).select("id").single());
  }
  if (error) return failure(error.message);
  if (data?.id) await syncProductMedia(data.id, formData, supabase);

  revalidatePath("/");
  revalidatePath("/products");
  redirect("/admin");
}

export async function updateProduct(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await assertAdmin())) return failure("Unauthorized.");

  const id = textFromForm(formData, "id");
  const parsed = parseProductForm(formData);
  if (!id) return failure("Missing product id.");
  if (!parsed.success) {
    return failure("Please fix the product fields.", parsed.error.flatten().fieldErrors);
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) return failure("Supabase service role key is required for admin product management.");

  const { data: existingProduct } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
  let { error } = await supabase
    .from("products")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (isMissingSalesLikelihoodColumn(error)) {
    ({ error } = await supabase
      .from("products")
      .update({ ...withoutSalesLikelihood(parsed.data), updated_at: new Date().toISOString() })
      .eq("id", id));
  }

  if (error) return failure(error.message);
  await syncProductMedia(id, formData, supabase);
  if (existingProduct?.etsy_listing_id && process.env.ETSY_AUTO_SYNC_ON_PRODUCT_SAVE === "true") {
    await syncProductToAttachedEtsyListing(id, false).catch(() => null);
  }

  revalidatePath("/");
  revalidatePath("/products");
  revalidatePath("/admin");
  redirect("/admin");
}

export async function importProductDriveMedia(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await assertAdmin())) return failure("Unauthorized.");

  const id = textFromForm(formData, "product_id");
  if (!id) return failure("Missing product id.");

  const supabase = createSupabaseAdminClient();
  if (!supabase) return failure("Supabase service role key is required for Drive media import.");

  const { data, error } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
  if (error) return failure(error.message);
  if (!data) return failure("Product not found.");

  const product = data as Product;
  const hasFolder = Boolean(product.drive_media_folder_url);
  const hasParentFolder = Boolean(process.env.PRINTZ_PRODUCT_MEDIA_PARENT_FOLDER_URL || process.env.PRINTZ_DRIVE_MEDIA_PARENT_FOLDER_URL);
  if (!hasFolder && !hasParentFolder) {
    return failure("Add a Drive media folder URL to this product, or configure PRINTZ_PRODUCT_MEDIA_PARENT_FOLDER_URL.");
  }

  const report = { mediaUploads: 0, mediaSkipped: 0 };
  try {
    await syncDriveMedia({
      drive: new GoogleDriveClient(process.env),
      supabase,
      product,
      folderUrl: product.drive_media_folder_url,
      row: product,
      idx: new Map(),
      rowNumber: 0,
      sheets: { batch: async () => {} },
      report,
    });
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Could not import Drive media.");
  }

  revalidatePath("/");
  revalidatePath("/products");
  revalidatePath("/admin");
  revalidatePath(`/admin/products/${product.id}`);
  if (product.slug) revalidatePath(`/products/${product.slug}`);

  return success(`Drive media imported. Uploaded ${report.mediaUploads} file${report.mediaUploads === 1 ? "" : "s"}; skipped ${report.mediaSkipped} already-uploaded file${report.mediaSkipped === 1 ? "" : "s"}.`);
}
export async function archiveProduct(formData: FormData) {
  if (!(await assertAdmin())) return;

  const id = textFromForm(formData, "id");
  const supabase = createSupabaseAdminClient();
  if (id && supabase) {
    const archiveResult = await supabase
      .from("products")
      .update({
        active: false,
        featured: false,
        workflow_status: "Archived",
        archived_at: new Date().toISOString(),
        last_sync_source: "website_admin",
      })
      .eq("id", id);

    // Keep archiving safe while the command-center migration is being deployed.
    if (archiveResult.error?.message.includes("workflow_status") || archiveResult.error?.message.includes("archived_at")) {
      await supabase.from("products").update({ active: false, featured: false }).eq("id", id);
    }
    revalidatePath("/");
    revalidatePath("/products");
    revalidatePath("/admin");
  }
}

export async function updateSuggestionStatus(formData: FormData) {
  if (!(await assertAdmin())) return;

  const id = textFromForm(formData, "id");
  const status = textFromForm(formData, "status");
  const supabase = createSupabaseAdminClient();
  if (id && status && supabase) {
    await supabase.from("suggestions").update({ status }).eq("id", id);
    revalidatePath("/admin");
  }
}

export async function deleteSuggestion(formData: FormData) {
  if (!(await assertAdmin())) return;

  const id = textFromForm(formData, "id");
  const supabase = createSupabaseAdminClient();
  if (id && supabase) {
    await supabase.from("suggestions").delete().eq("id", id);
    revalidatePath("/admin");
  }
}

export async function syncEtsyProducts(state: ActionState, formData: FormData): Promise<ActionState> {
  void state;
  void formData;

  if (!(await assertAdmin())) return failure("Unauthorized.");

  try {
    const etsyToken = await getValidEtsyOAuthToken().catch(() => null);
    const result = await syncEtsyListings({ accessToken: etsyToken?.access_token });
    revalidatePath("/");
    revalidatePath("/products");
    revalidatePath("/admin");
    revalidatePath("/admin/etsy");

    return result.ok ? success(result.message) : failure(result.message);
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Etsy sync failed.");
  }
}

export async function createProductFromTrendReport(formData: FormData) {
  if (!(await assertAdmin())) return;

  const reportId = textFromForm(formData, "report_id");
  const supabase = createSupabaseAdminClient();
  if (!reportId || !supabase) return;

  const { data, error } = await supabase
    .from("etsy_trend_reports")
    .select("*")
    .eq("id", reportId)
    .maybeSingle();
  if (error || !data) return;

  const productId = await createOpportunityProductFromReport(data as EtsyTrendReport, supabase);

  revalidatePath("/admin");
  revalidatePath("/admin/trends");
  revalidatePath(`/admin/products/${productId}`);
  redirect(`/admin/products/${productId}`);
}

export async function createOpportunityDraftsFromChatsSheet(
  _: BulkOpportunityDraftState,
  formData: FormData,
): Promise<BulkOpportunityDraftState> {
  if (!(await assertAdmin())) return failure("Unauthorized.");

  const supabase = createSupabaseAdminClient();
  if (!supabase) return failure("Supabase service role key is required.");

  const spreadsheetInput = optionalTextFromForm(formData, "spreadsheet_id") || process.env.PRINTZ_PRODUCT_SHEET_ID || "14L2liBREJYQSO_rhaAon_1RXonZIah91y77f4T3ctXs";
  const spreadsheetRef = spreadsheetRefFromInput(spreadsheetInput);
  const spreadsheetId = spreadsheetRef.id;
  const requestedSheet = optionalTextFromForm(formData, "sheet_name");
  const limit = clampNumber(textFromForm(formData, "limit"), 1, 100, 20);
  const allowReviewDrafts = formData.get("allow_review_drafts") === "on";
  await saveBulkOpportunitySettings({
    spreadsheetInput,
    sheetName: requestedSheet || "",
    limit,
    allowReviewDrafts,
  });

  try {
    const sheets = new GoogleSheetsClient({ spreadsheetId, env: process.env });
    const sheetName = await resolveSheetName(sheets, { requestedSheet, gid: spreadsheetRef.gid });
    if (!sheetName) return failure("Could not find a chats/opportunities sheet tab. Enter the tab name and try again.");

    const rows = await sheets.getValues(`${quoteSheetName(sheetName)}!A1:AZ500`);
    const opportunities = rowsToOpportunityReports(rows, sheetName, { allowReviewDrafts }).slice(0, limit);
    if (!opportunities.length) {
      return failure(`No high-opportunity product rows found in ${sheetName}. Add title/name plus opportunity score, priority, or status columns.`);
    }

    let created = 0;
    let skipped = 0;
    for (const report of opportunities) {
      const before = await findProductIdByName(report.recommended_listing.title || report.title, supabase);
      if (before) {
        skipped++;
        continue;
      }
      await createOpportunityProductFromReport(report, supabase);
      created++;
    }

    revalidatePath("/admin");
    revalidatePath("/admin/ai");
    revalidatePath("/admin/trends");

    return {
      ok: true,
      message: `Created ${created} product draft${created === 1 ? "" : "s"} from ${sheetName}. Skipped ${skipped} existing product${skipped === 1 ? "" : "s"}.`,
      created,
      skipped,
    };
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Could not create drafts from the chats sheet.");
  }
}

export async function getBulkOpportunitySettings() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(bulkOpportunitySettingsCookie)?.value;
  if (!raw) return { spreadsheetInput: "", sheetName: "chats list", limit: "20", allowReviewDrafts: false };

  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as {
      spreadsheetInput?: string;
      sheetName?: string;
      limit?: number | string;
      allowReviewDrafts?: boolean;
    };

    return {
      spreadsheetInput: String(parsed.spreadsheetInput || ""),
      sheetName: String(parsed.sheetName || "chats list"),
      limit: String(parsed.limit || "20"),
      allowReviewDrafts: Boolean(parsed.allowReviewDrafts),
    };
  } catch {
    return { spreadsheetInput: "", sheetName: "chats list", limit: "20", allowReviewDrafts: false };
  }
}

async function saveBulkOpportunitySettings(settings: { spreadsheetInput: string; sheetName: string; limit: number; allowReviewDrafts: boolean }) {
  const cookieStore = await cookies();
  cookieStore.set(
    bulkOpportunitySettingsCookie,
    Buffer.from(JSON.stringify(settings), "utf8").toString("base64url"),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 365 * 24 * 60 * 60,
    },
  );
}

export async function getProductResearchPipeline(): Promise<ProductResearchPipeline> {
  if (!(await assertAdmin())) {
    return emptyProductResearchPipeline("Unauthorized.");
  }

  const settings = await getBulkOpportunitySettings();
  const spreadsheetInput = settings.spreadsheetInput || process.env.PRINTZ_PRODUCT_SHEET_ID || "14L2liBREJYQSO_rhaAon_1RXonZIah91y77f4T3ctXs";
  const spreadsheetRef = spreadsheetRefFromInput(spreadsheetInput);

  try {
    const sheets = new GoogleSheetsClient({ spreadsheetId: spreadsheetRef.id, env: process.env });
    const sheetName = await resolveSheetName(sheets, { requestedSheet: settings.sheetName, gid: spreadsheetRef.gid });
    if (!sheetName) return emptyProductResearchPipeline("Could not resolve the product research sheet tab.");

    const rows = await sheets.getValues(`${quoteSheetName(sheetName)}!A1:AZ500`);
    const pipelineRows = rowsToPipelineRows(rows);
    return {
      ok: true,
      message: `Loaded ${pipelineRows.length} product research row${pipelineRows.length === 1 ? "" : "s"} from ${sheetName}.`,
      spreadsheetInput,
      sheetName,
      totalRows: pipelineRows.length,
      topOpportunities: pipelineRows.filter((row) => row.canDraft).slice(0, 12),
      licenseReviewQueue: pipelineRows.filter((row) => /review|manual|unknown|needs/i.test(`${row.sourceQuality} ${row.commercialUse} ${row.blockReason}`)).slice(0, 12),
      readyToPrintQueue: pipelineRows.filter((row) => /ready to print|print next|ready/i.test(`${row.status} ${row.nextAction}`) && row.canDraft).slice(0, 12),
      draftReadyQueue: pipelineRows.filter((row) => row.canDraft && row.modelLink).slice(0, 12),
    };
  } catch (error) {
    return emptyProductResearchPipeline(error instanceof Error ? error.message : "Could not load product research pipeline.");
  }
}

function emptyProductResearchPipeline(message: string): ProductResearchPipeline {
  return {
    ok: false,
    message,
    spreadsheetInput: "",
    sheetName: "",
    totalRows: 0,
    topOpportunities: [],
    licenseReviewQueue: [],
    readyToPrintQueue: [],
    draftReadyQueue: [],
  };
}

export async function saveEtsyRuntimeSettings(state: ActionState, formData: FormData): Promise<ActionState> {
  void state;

  if (!(await assertAdmin())) return failure("Unauthorized.");

  const settings = {
    shopId: textFromForm(formData, "shop_id"),
    taxonomyId: textFromForm(formData, "taxonomy_id"),
    shippingProfileId: optionalTextFromForm(formData, "shipping_profile_id") || "",
    readinessStateId: optionalTextFromForm(formData, "readiness_state_id") || "",
    returnPolicyId: optionalTextFromForm(formData, "return_policy_id") || "",
  };

  if (!settings.shopId || !settings.taxonomyId) {
    return failure("Shop ID and default taxonomy ID are required. Shipping/readiness IDs are required before creating physical product drafts.");
  }

  await setEtsyRuntimeSettings(settings);
  revalidatePath("/admin/etsy");

  return success("Saved Etsy IDs for this admin browser. The draft buttons can use them now.");
}

export async function createEtsyDraftListing(state: EtsyDraftState, formData: FormData): Promise<EtsyDraftState> {
  void state;

  if (!(await assertAdmin())) return failure("Unauthorized.");

  const productId = textFromForm(formData, "product_id");
  if (!productId) return failure("Missing product id.");

  const supabase = createSupabaseAdminClient();
  if (!supabase) return failure("Supabase service role key is required.");

  const { data, error } = await supabase.from("products").select("*").eq("id", productId).maybeSingle();
  if (error) return failure(error.message);
  if (!data) return failure("Product not found.");

  const product = data as Product;
  if (product.etsy_listing_id || product.etsy_url) {
    return {
      ok: true,
      message: "This product already has an Etsy listing attached.",
      listingUrl: product.etsy_url || undefined,
    };
  }

  const [etsyToken, etsySettings] = await Promise.all([getValidEtsyOAuthToken(), getEffectiveEtsyRuntimeSettings()]);
  const missing = etsyDraftRequirements(product, { hasOAuthToken: Boolean(etsyToken?.access_token), settings: etsySettings });
  if (missing.length) {
    return failure(
      `This site can generate the Etsy draft from the product, but these settings are still needed first: ${missing.join(", ")}.`,
    );
  }

  try {
    const result = await createEtsyDraftFromProduct({
      apiKey: process.env.ETSY_API_KEY!,
      accessToken: etsyToken?.access_token || process.env.ETSY_ACCESS_TOKEN!,
      shopId: etsySettings.shopId,
      taxonomyId: etsySettings.taxonomyId,
      shippingProfileId: etsySettings.shippingProfileId,
      readinessStateId: etsySettings.readinessStateId,
      product,
    });

    await supabase
      .from("products")
      .update({
        etsy_listing_id: result.listingId,
        etsy_url: result.url,
        etsy_state: "draft",
        active: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", product.id);

    revalidatePath("/");
    revalidatePath("/products");
    revalidatePath("/admin");
    revalidatePath("/admin/etsy");

    return {
      ok: true,
      message: "Created an Etsy draft listing from this website product. Add photos/files in Etsy before publishing.",
      listingUrl: result.url,
    };
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Could not create Etsy draft listing.");
  }
}

export async function generateAiListing(
  _: AiListingState,
  formData: FormData,
): Promise<AiListingState> {
  if (!(await assertAdmin())) return failure("Unauthorized.");

  if (!getOpenAiApiKeys().length) {
    return failure(openAiKeyMissingMessage());
  }

  const idea = textFromForm(formData, "idea");
  const sourceText = optionalTextFromForm(formData, "source_text");
  const sourceUrl = optionalTextFromForm(formData, "source_url");
  const sourceImageUrl = optionalTextFromForm(formData, "source_image_url");
  const category = textFromForm(formData, "category");
  const audience = optionalTextFromForm(formData, "audience");
  const notes = optionalTextFromForm(formData, "notes");

  if (!idea && !sourceUrl && !sourceText) {
    return failure("Add a product idea, source listing URL, or pasted MakerWorld content.");
  }

  const prompt = [
    "Create a structured product listing draft for PRINTZ By Khan, a shop focused on 3D printed products and digital products.",
    "The draft will be reviewed by an admin before publishing.",
    "Return only valid JSON with these exact keys:",
    "name, slug, short_description, full_description, category, price, etsy_url, main_image_url, video_url, gallery_media_urls, materials, dimensions, customization_notes, personalization_enabled, personalization_prompt, color_options, size_options, finish_options, processing_time, care_instructions, source_url, license_notes, tags, featured, active.",
    "Rules:",
    "- Do not claim we own third-party designs unless the prompt says it is original.",
    "- If the source is MakerWorld, Printables, Thingiverse, Cults, or similar, include a license warning in license_notes and tell the admin to verify commercial selling rights before publishing.",
    "- Convert copied MakerWorld model text into a buyer-facing Etsy/website product listing. Do not copy the source description verbatim.",
    "- Avoid trademarked brand names in the product name unless clearly generic.",
    "- tags must be a comma-separated string with Etsy-style search terms.",
    "- color_options, size_options, and finish_options must be comma-separated strings.",
    "- If personalization makes sense, set personalization_enabled true and write a clear personalization_prompt for what the buyer should enter.",
    "- Suggest practical color, size, and finish choices for 3D printed products when relevant.",
    "- price must be a numeric string like 24 or 34.99.",
    "- If Source image URL is provided, use it exactly as main_image_url.",
    "- etsy_url and video_url should be empty strings unless provided.",
    "- active should be true and featured should be false unless it seems launch-worthy.",
    "",
    `Product idea: ${idea || "Use source URL as the basis."}`,
    `Source URL: ${sourceUrl || ""}`,
    `Source image URL: ${sourceImageUrl || ""}`,
    `Pasted MakerWorld/source content: ${sourceText || ""}`,
    `Preferred category: ${category || "Custom Orders"}`,
    `Target buyer/audience: ${audience || ""}`,
    `Admin notes: ${notes || ""}`,
  ].join("\n");

  try {
    const result = await createOpenAiResponse({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      fallbackModel: "gpt-4.1-mini",
      input: prompt,
      max_output_tokens: 1600,
    });
    const text =
      typeof result.output_text === "string"
        ? result.output_text
        : extractResponseText(result) || "";
    const draft = parseAiDraft(text);

    if (!draft) {
      return failure("The AI response could not be parsed. Try a more specific product idea.");
    }
    if (sourceImageUrl && !draft.main_image_url) {
      draft.main_image_url = sourceImageUrl;
    }
    if (sourceUrl && !draft.source_url) {
      draft.source_url = sourceUrl;
    }

    return {
      ok: true,
      message: "Draft generated. Review and edit before creating the product.",
      draft,
    };
  } catch (error) {
    return failure(error instanceof Error ? error.message : "AI generation failed. Please try again.");
  }
}

export async function autofillProductEtsyFields(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await assertAdmin())) return failure("Unauthorized.");

  const id = textFromForm(formData, "product_id");
  if (!id) return failure("Missing product id.");

  const supabase = createSupabaseAdminClient();
  if (!supabase) return failure("Supabase service role key is required.");

  const { data, error } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
  if (error) return failure(error.message);
  if (!data) return failure("Product not found.");

  const product = data as Product;
  const research = await getProductSheetResearch(product).catch(() => null);
  const prompt = [
    "You are filling missing Etsy-readiness fields for PRINTZ Team Official.",
    "Use the product record and Google Sheet research to write buyer-facing, high-yield Etsy listing content.",
    "Do not invent license certainty. If source rights are unclear, keep license_notes conservative.",
    "Avoid protected artwork, logos, trademark-heavy claims, and copied source listing text.",
    "Use researched keywords naturally in tags and copy, especially high-volume/low-competition phrases.",
    "Return only valid JSON with this exact shape:",
    "{\"price\":\"14.99\",\"short_description\":\"...\",\"full_description\":\"...\",\"materials\":\"...\",\"dimensions\":\"...\",\"tags\":\"tag one, tag two\",\"processing_time\":\"...\",\"care_instructions\":\"...\",\"customization_notes\":\"...\",\"personalization_enabled\":false,\"personalization_prompt\":\"...\",\"color_options\":\"...\",\"size_options\":\"...\",\"finish_options\":\"...\",\"license_notes\":\"...\"}",
    "Rules:",
    "- price must be a numeric string and should use sheet suggested price/range when available.",
    "- full_description must cover use case, what is included, size expectations, material/finish expectations, customization, processing, and review-before-sale notes.",
    "- materials must list filament/material and any included hardware or production caveat.",
    "- dimensions must give a practical size range or 'custom sizes available; confirm final dimensions before ordering' when exact size is unknown.",
    "- tags must include 8 to 13 Etsy-style search phrases, comma-separated, no duplicates.",
    "- keep tags concise; avoid leading with trademarked brands unless unavoidable compatibility wording.",
    "- processing_time should be a simple buyer-facing phrase.",
    "- care_instructions should mention heat, cleaning, and normal 3D print layer lines when physical.",
    "",
    `Product JSON: ${JSON.stringify(product)}`,
    `Sheet research JSON: ${JSON.stringify(research || {})}`,
  ].join("\n");

  const applyDraft = async (draft: EtsyAutofillDraft, mode: "AI" | "Local fallback") => {
    const patch = buildEtsyAutofillPatch(product, draft);
    if (!Object.keys(patch).length) {
      return success(`${mode} checked this product, but no missing Etsy readiness fields needed changes.`);
    }

    const { error: updateError } = await supabase
      .from("products")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", product.id);
    if (updateError) return failure(updateError.message);

    revalidatePath("/");
    revalidatePath("/products");
    revalidatePath("/admin");
    revalidatePath(`/admin/products/${product.id}`);
    if (product.slug) revalidatePath(`/products/${product.slug}`);

    return success(`${mode} filled Etsy fields: ${Object.keys(patch).filter((key) => key !== "updated_at").join(", ")}.`);
  };

  if (!getOpenAiApiKeys().length) {
    return applyDraft(buildLocalEtsyAutofillDraft(product, research), "Local fallback");
  }

  try {
    const result = await createOpenAiResponse({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      fallbackModel: "gpt-4.1-mini",
      input: prompt,
      max_output_tokens: 1800,
    });
    const text = typeof result.output_text === "string" ? result.output_text : extractResponseText(result) || "";
    const draft = parseEtsyAutofillDraft(text);
    if (!draft) return failure("The AI autofill response could not be parsed. Try again.");

    return applyDraft(draft, "AI");
  } catch {
    return applyDraft(buildLocalEtsyAutofillDraft(product, research), "Local fallback");
  }
}

export async function automateProductListingDraft(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await assertAdmin())) return failure("Unauthorized.");

  const id = textFromForm(formData, "product_id");
  if (!id) return failure("Missing product id.");

  const fillResult = await autofillProductEtsyFields({ ok: false, message: "" }, formData);
  if (!fillResult.ok) return fillResult;

  const supabase = createSupabaseAdminClient();
  if (!supabase) return failure("Supabase service role key is required.");

  const [{ data, error }, mediaResult] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).maybeSingle(),
    supabase.from("product_media").select("*").eq("product_id", id).order("sort_order", { ascending: true }),
  ]);
  if (error) return failure(error.message);
  if (!data) return failure("Product not found after AI fill.");

  const product = data as Product;
  const media = (mediaResult.data || []) as ProductMedia[];
  const imageCount = media.filter((item) => item.media_type === "image").length + (product.main_image_url ? 1 : 0);
  const readiness = getEtsyReadiness(product, { imageCount });
  if (!readiness.readyToDraft) {
    const missing = readiness.items
      .filter((item) => item.level === "required" && !item.ok)
      .map((item) => item.label)
      .join(", ");
    return success(`${fillResult.message} Etsy draft is waiting on: ${missing || "required fields"}. Add source/images or details, then run automation again.`);
  }

  const draftResult = await syncProductToAttachedEtsyListing(id, false);
  if (!draftResult.ok) {
    return failure(`${fillResult.message} AI fill succeeded, but Etsy draft creation needs attention: ${draftResult.message}`);
  }

  return success(`${fillResult.message} ${draftResult.message}`);
}

export async function generateAiScoutListing(_: AiScoutState, formData: FormData): Promise<AiScoutState> {
  if (!(await assertAdmin())) return failure("Unauthorized.");

  if (!getOpenAiApiKeys().length) return failure(openAiKeyMissingMessage());

  const message = textFromForm(formData, "message");
  const sourceUrl = optionalTextFromForm(formData, "source_url");
  const sourceText = optionalTextFromForm(formData, "source_text");
  const targetAudience = optionalTextFromForm(formData, "target_audience");

  if (!message && !sourceUrl && !sourceText) {
    return failure("Ask a question, paste a source URL, or paste product/source text.");
  }

  const prompt = [
    "You are an admin-only product scouting assistant for PRINTZ By Khan.",
    "Research the product idea or source link, analyze Etsy viability, identify buyer/search angles, and assess commercial selling-rights risk.",
    "You must be conservative about rights: do not say rights are guaranteed. If a license is unclear, mark the risk Medium or High and say what the admin must verify before selling.",
    "Prioritize 3D printed products, digital products, and Etsy-friendly custom listings.",
    "Return only valid JSON with this exact shape:",
    "{\"answer\":\"...\",\"viability_score\":0,\"rights_risk\":\"Low|Medium|High\",\"rights_notes\":\"...\",\"sources_to_check\":[\"...\"],\"draft\":{\"name\":\"...\",\"slug\":\"...\",\"short_description\":\"...\",\"full_description\":\"...\",\"category\":\"...\",\"price\":\"...\",\"etsy_url\":\"\",\"main_image_url\":\"...\",\"video_url\":\"...\",\"gallery_media_urls\":\"...\",\"materials\":\"...\",\"dimensions\":\"...\",\"customization_notes\":\"...\",\"personalization_enabled\":false,\"personalization_prompt\":\"...\",\"color_options\":\"...\",\"size_options\":\"...\",\"finish_options\":\"...\",\"processing_time\":\"...\",\"care_instructions\":\"...\",\"source_url\":\"...\",\"license_notes\":\"...\",\"tags\":\"...\",\"featured\":false,\"active\":true}}",
    "",
    `Admin question: ${message}`,
    `Source URL: ${sourceUrl || ""}`,
    `Source copied text: ${sourceText || ""}`,
    `Target audience: ${targetAudience || ""}`,
  ].join("\n");

  try {
    const result = await createOpenAiResponse({
      model: process.env.OPENAI_RESEARCH_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini",
      fallbackModel: "gpt-4.1-mini",
      input: prompt,
      tools: [{ type: "web_search", search_context_size: "medium" }],
      max_output_tokens: 3600,
    });
    const text = typeof result.output_text === "string" ? result.output_text : extractResponseText(result) || "";
    const parsed = parseAiScout(text);
    if (!parsed) return failure("The AI scout response could not be parsed. Try a more specific URL or product idea.");
    return {
      ok: true,
      message: "Scout analysis complete. Review the rights notes before creating a listing.",
      ...parsed,
    };
  } catch (error) {
    return failure(error instanceof Error ? error.message : "AI scout failed.");
  }
}

export async function generateAiMarketResearch(
  _: AiMarketResearchState,
  formData: FormData,
): Promise<AiMarketResearchState> {
  if (!(await assertAdmin())) return failure("Unauthorized.");

  if (!getOpenAiApiKeys().length) {
    return failure(openAiKeyMissingMessage());
  }

  const focus = textFromForm(formData, "focus") || "Etsy opportunities for PRINTZ";
  const productTypes = textFromForm(formData, "product_types") || "digital products and 3D printed products";
  const audience = optionalTextFromForm(formData, "audience") || "teachers, desk setup buyers, gift buyers, students, home organization buyers";
  const notes = optionalTextFromForm(formData, "notes");
  const reportDate = todayInNewYork();

  const prompt = [
    "Research Etsy marketplace opportunities for PRINTZ By Khan.",
    "Use current web information and prioritize Etsy-visible listing patterns, search language, listing packaging, price positioning, and buyer-facing presentation.",
    "PRINTZ focuses on digital products, 3D printed products, and hybrid ideas. Keep those at the forefront.",
    "Do not copy protected artwork. Do not claim private sales data. Clearly label visible signals and inferences.",
    "The recommended listing may become an inactive website product draft before the actual MakerWorld/source product and photos are found.",
    "Write the recommendation so missing source-specific fields can wait: exact dimensions, source license, exact material requirements, and final photos can be filled after the admin adds the source URL and images.",
    "Return only valid JSON with this exact shape:",
    "{\"report_date\":\"YYYY-MM-DD\",\"title\":\"...\",\"summary\":\"...\",\"top_trends\":[\"...\"],\"listing_ideas\":[\"...\"],\"recommended_listing\":{\"title\":\"...\",\"product_type\":\"Digital|3D Printed|Hybrid\",\"price\":\"...\",\"category\":\"...\",\"tags\":[\"...\"],\"description\":\"...\",\"files_or_variants\":\"...\",\"photo_plan\":\"...\",\"next_steps\":\"...\"},\"source_notes\":\"...\"}",
    "",
    `Report date: ${reportDate}`,
    `Research focus: ${focus}`,
    `Product types: ${productTypes}`,
    `Target audience: ${audience}`,
    `Admin notes: ${notes || ""}`,
  ].join("\n");

  try {
    const result = await createOpenAiResponse({
      model: process.env.OPENAI_RESEARCH_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini",
      fallbackModel: "gpt-4.1-mini",
      input: prompt,
      tools: [{ type: "web_search", search_context_size: "medium" }],
      max_output_tokens: 3500,
    });
    const text =
      typeof result.output_text === "string"
        ? result.output_text
        : extractResponseText(result) || "";
    const report = parseMarketResearchReport(text, reportDate);

    if (!report) {
      return failure("The AI research response could not be parsed. Try a narrower focus.");
    }

    const supabase = createSupabaseAdminClient();
    if (!supabase) return failure("Supabase service role key is required to save the report.");

    const { data: savedReport, error } = await supabase.from("etsy_trend_reports").insert(report).select("*").single();
    if (error) return failure(error.message);

    const productId = savedReport
      ? await createOpportunityProductFromReport(savedReport as EtsyTrendReport, supabase).catch(() => "")
      : "";

    revalidatePath("/admin");
    revalidatePath("/admin/trends");
    if (productId) revalidatePath(`/admin/products/${productId}`);

    return {
      ok: true,
      message: productId
        ? "Market research saved and an inactive product opportunity was created. Add source/images, then use AI fill before creating the Etsy draft."
        : "Market research report generated and saved to Trend reports. Product draft creation needs review.",
      report,
      productId,
    };
  } catch (error) {
    return failure(error instanceof Error ? error.message : "AI market research failed. Please try again.");
  }
}

async function createOpportunityProductFromReport(
  report: EtsyTrendReport,
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
) {
  const listing = report.recommended_listing || {};
  const title = cleanOpportunityText(listing.title) || cleanOpportunityText(report.title) || "PRINTZ product opportunity";
  const existingProductId = await findProductIdByName(title, supabase);
  if (existingProductId) return existingProductId;
  const category = normalizeProductCategory(listing.category || listing.product_type || "");
  const sourceUrl = sourceUrlFromReport(report);
  const slug = await uniqueProductSlug(slugify(title), supabase);
  const price = parseOpportunityPrice(listing.price);
  const description = cleanOpportunityText(listing.description) || cleanOpportunityText(report.summary);
  const tags = normalizeStringArray(listing.tags).length
    ? normalizeStringArray(listing.tags).slice(0, 13)
    : opportunityTags(report, listing, category);
  const sourceNotes = [
    "AI-created product opportunity from Etsy trend research.",
    sourceUrl ? `Source/model URL from research: ${sourceUrl}` : "Add the MakerWorld, Printables, or original source URL before selling.",
    "Confirm commercial-use rights, attribution, and any modification limits before creating or publishing an Etsy listing.",
    report.source_notes ? `Research notes: ${report.source_notes}` : "",
  ].filter(Boolean).join("\n\n");

  const product = {
    name: title,
    slug,
    short_description: summarizeOpportunity(description || `${title} product opportunity for PRINTZ.`),
    full_description: [
      description || `${title} is a researched product opportunity for PRINTZ.`,
      listing.files_or_variants ? `Files or variants to plan: ${listing.files_or_variants}` : "",
      listing.photo_plan ? `Photo plan: ${listing.photo_plan}` : "Photo plan: add original product photos after selecting or making the product.",
      listing.next_steps ? `Next steps: ${listing.next_steps}` : "Next steps: find the product/source model, confirm rights, add images, then run AI fill.",
      "Source and exact dimensions are intentionally pending until the real product/model is selected.",
    ].filter(Boolean).join("\n\n"),
    category,
    price,
    etsy_url: null,
    main_image_url: null,
    video_url: null,
    materials: "Pending source model. Run AI fill after adding the MakerWorld/source URL.",
    dimensions: "Pending source model. Run AI fill after source and product details are added.",
    customization_notes: listing.files_or_variants || "Options will be finalized after the source product is selected.",
    personalization_enabled: /personal|custom|name|initial/i.test(`${title} ${description} ${listing.files_or_variants || ""}`),
    personalization_prompt: /personal|custom|name|initial/i.test(`${title} ${description} ${listing.files_or_variants || ""}`)
      ? "Add personalization details after the product/source is selected."
      : null,
    color_options: ["Black", "White", "Custom color"],
    size_options: ["Standard", "Custom size"],
    finish_options: ["Standard"],
    processing_time: "Made to order after source/product review",
    care_instructions: "Final care notes will be filled after the actual product material and source model are selected.",
    source_url: sourceUrl || null,
    license_notes: sourceNotes,
    tags,
    featured: false,
    active: false,
  };
  const opsFields = {
    workflow_status: "Research",
    rights_status: "Needs Review",
    media_status: "Missing",
    pricing_status: price ? "Ready" : "Needs Inputs",
  };

  const { data, error } = await supabase
    .from("products")
    .insert({ ...product, ...opsFields })
    .select("id")
    .single();

  if (!error && data?.id) return data.id as string;
  if (!isMissingColumnError(error)) throw error;

  const fallback = await supabase.from("products").insert(product).select("id").single();
  if (fallback.error) throw fallback.error;
  return fallback.data.id as string;
}

async function findProductIdByName(name: string, supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>) {
  const title = cleanOpportunityText(name);
  if (!title) return "";
  const { data } = await supabase.from("products").select("id").eq("name", title).maybeSingle();
  return data?.id ? String(data.id) : "";
}

async function resolveSheetName(sheets: GoogleSheetsClient, { requestedSheet, gid }: { requestedSheet?: string | null; gid?: string }) {
  const metadata = await sheets.request(`https://sheets.googleapis.com/v4/spreadsheets/${sheets.id}?fields=sheets(properties(sheetId,title))`);
  const sheetsList = ((metadata?.sheets || []) as Array<{ properties?: { sheetId?: number; title?: string } }>)
    .map((sheet) => ({ id: String(sheet.properties?.sheetId ?? ""), title: sheet.properties?.title || "" }))
    .filter((sheet) => sheet.title);
  const requested = cleanOpportunityText(requestedSheet || "");

  if (requested) {
    const exact = sheetsList.find((sheet) => sheet.title.toLowerCase() === requested.toLowerCase());
    if (exact) return exact.title;
    const contains = sheetsList.find((sheet) => sheet.title.toLowerCase().includes(requested.toLowerCase()));
    if (contains) return contains.title;
  }

  if (gid) {
    const byGid = sheetsList.find((sheet) => sheet.id === gid);
    if (byGid) return byGid.title;
  }

  return sheetsList.find((sheet) => /chat|opportunit|trend|research/i.test(sheet.title))?.title || "";
}

function rowsToOpportunityReports(rows: unknown[][], sheetName: string, options: { allowReviewDrafts: boolean }): EtsyTrendReport[] {
  return rowsToPipelineRows(rows)
    .filter((row) => shouldCreateDraftFromPipelineRow(row, options))
    .map((row) => pipelineRowToOpportunityReport(row, sheetName))
    .sort((a, b) => opportunityScore(b) - opportunityScore(a));
}

function rowsToPipelineRows(rows: unknown[][]): ProductResearchPipelineRow[] {
  const [headerRow, ...bodyRows] = rows;
  const headers = (headerRow || []).map((value) => normalizeSheetHeader(String(value || "")));
  if (!headers.length) return [];

  return bodyRows
    .map((row, index) => rowToPipelineRow(headers, row, index + 2))
    .filter((row): row is ProductResearchPipelineRow => Boolean(row))
    .sort((a, b) => b.selectionScore - a.selectionScore);
}

function rowToPipelineRow(headers: string[], row: unknown[], rowNumber: number): ProductResearchPipelineRow | null {
  const value = rowValue(headers, row);
  const product = value("product", "product name", "title", "name", "listing title", "recommended listing", "idea", "product idea");
  if (!product) return null;

  const commercialUse = value("commercial use", "commercial sale allowed", "can sell", "sellable");
  const license = value("license", "license type", "exact license");
  const status = value("status", "workflow status", "next status");
  const priority = value("priority", "shop priority", "rank", "tier");
  const sourceQuality = classifySourceQuality({ commercialUse, license, status });
  const blockReason = draftBlockReason({ commercialUse, license, status, sourceQuality });
  const opportunityScore = numberFromText(value("opportunity score", "ai opportunity score", "score", "viability score"));
  const confidence = numberFromText(value("confidence", "ai confidence", "confidence %"));
  const keywordScore = numberFromText(value("keyword score", "ai keyword score estimate"));
  const selectionScore = calculatePipelineSelectionScore({
    opportunityScore,
    confidence,
    keywordScore,
    priority,
    status,
    commercialUse,
    sourceQuality,
    competition: value("competition", "etsy saturation", "ai competition estimate"),
    personalization: value("personalization"),
    printTime: value("print time", "estimated print hours"),
    evergreen: value("evergreen/seasonal", "evergreen", "seasonality"),
  });

  return {
    rowNumber,
    product,
    category: value("category"),
    priority,
    status,
    opportunityScore,
    confidence,
    commercialUse,
    sourceQuality,
    modelLink: value("model link", "model source", "source url", "maker world link", "makerworld link", "printables link"),
    nextAction: value("next action", "action", "todo"),
    selectionScore,
    canDraft: !blockReason,
    blockReason,
  };
}

function pipelineRowToOpportunityReport(row: ProductResearchPipelineRow, sheetName: string): EtsyTrendReport {
  const reportDate = todayInNewYork();

  return {
    id: `sheet:${sheetName}:${row.rowNumber}`,
    report_date: reportDate,
    title: `${row.product} opportunity`,
    summary: `${row.product} scored ${Math.round(row.selectionScore)} in the Product Research pipeline. ${row.nextAction || "Review source, license, and listing strategy."}`,
    top_trends: [row.priority, row.status, row.sourceQuality].filter(Boolean),
    listing_ideas: [row.nextAction].filter(Boolean),
    recommended_listing: {
      title: row.product,
      product_type: "3D Printed",
      price: "",
      category: row.category,
      tags: [],
      description: `${row.product} was selected from ${sheetName} as a high-opportunity PRINTZ product draft.`,
      files_or_variants: "",
      photo_plan: "Add original photos after finding or printing the product. Reference images are internal only.",
      next_steps: row.nextAction || "Find/confirm source model, verify license, add images, then run AI fill.",
    },
    source_notes: `Imported from ${sheetName} row ${row.rowNumber}. Selection score: ${Math.round(row.selectionScore)}. Opportunity score: ${row.opportunityScore ?? "not provided"}. Confidence: ${row.confidence ?? "not provided"}. Commercial use: ${row.commercialUse || "not provided"}. Source quality: ${row.sourceQuality}. Model link: ${row.modelLink || "not provided"}.`,
    created_at: new Date().toISOString(),
  };
}

function rowValue(headers: string[], row: unknown[]) {
  return (...aliases: string[]) => {
    for (const alias of aliases.map(normalizeSheetHeader)) {
      const index = headers.indexOf(alias);
      if (index >= 0) {
        const text = cleanOpportunityText(String(row[index] || ""));
        if (text) return text;
      }
    }
    return "";
  };
}

function shouldCreateDraftFromPipelineRow(row: ProductResearchPipelineRow, options: { allowReviewDrafts: boolean }) {
  if (!row.product) return false;
  if (row.blockReason && !(options.allowReviewDrafts && /manual|review|unknown/i.test(row.blockReason))) return false;
  return row.selectionScore >= 45 || /\bhigh|highest|top|ready|print next|draft|priority\b/i.test(`${row.priority} ${row.status} ${row.nextAction}`);
}

function draftBlockReason({ commercialUse, license, status, sourceQuality }: { commercialUse: string; license: string; status: string; sourceQuality: string }) {
  const text = `${commercialUse} ${license} ${status} ${sourceQuality}`.toLowerCase();
  if (/\b(non[\s-]?commercial|cc[\s-]?by[\s-]?nc|\bnc\b|cannot sell|do not sell|no commercial|rejected)\b/i.test(text)) return "Non-commercial / cannot sell";
  if (/\bneeds license review|needs manual|unknown|unverified|manual verification|needs review\b/i.test(text)) return "Needs manual verification";
  if (commercialUse && !/\byes|allowed|commercial|cc0|public domain\b/i.test(commercialUse)) return "Commercial use not confirmed";
  return "";
}

function classifySourceQuality({ commercialUse, license, status }: { commercialUse: string; license: string; status: string }) {
  const text = `${commercialUse} ${license} ${status}`.toLowerCase();
  if (/\bshop owned|shop-owned|cad|original\b/i.test(text)) return "Shop-owned CAD";
  if (/\b(non[\s-]?commercial|cc[\s-]?by[\s-]?nc|\bnc\b|cannot sell|no commercial)\b/i.test(text)) return "Non-commercial reject";
  if (/\bcc0|public domain\b/i.test(text)) return "Verified commercial model";
  if (/\bcc[\s-]?by[\s-]?sa|sharealike|share alike\b/i.test(text)) return "ShareAlike required";
  if (/\bcc[\s-]?by[\s-]?nd|no derivatives|no-derivatives\b/i.test(text)) return "No-derivatives / unmodified only";
  if (/\bcc[\s-]?by|attribution required|attribution\b/i.test(text)) return "Attribution required";
  if (/\byes|commercial use allowed|allowed|verified|approved\b/i.test(text)) return "Verified commercial model";
  return "Needs manual verification";
}

function calculatePipelineSelectionScore({
  commercialUse,
  competition,
  confidence,
  evergreen,
  keywordScore,
  opportunityScore,
  personalization,
  printTime,
  priority,
  sourceQuality,
  status,
}: {
  commercialUse: string;
  competition: string;
  confidence: number | null;
  evergreen: string;
  keywordScore: number | null;
  opportunityScore: number | null;
  personalization: string;
  printTime: string;
  priority: string;
  sourceQuality: string;
  status: string;
}) {
  const demand = opportunityScore ?? keywordScore ?? 50;
  const lowCompetition = /low|easy|weak/i.test(competition) ? 100 : /high|saturated/i.test(competition) ? 25 : 60;
  const profit = 65;
  const personalizationScore = /yes|high|personal|custom|name/i.test(personalization) ? 100 : 45;
  const licenseSafety = sourceQuality === "Verified commercial model" || /yes|allowed/i.test(commercialUse)
    ? 100
    : sourceQuality === "Attribution required" || sourceQuality === "ShareAlike required"
      ? 75
      : sourceQuality === "Needs manual verification"
        ? 35
        : 0;
  const evergreenScore = /evergreen|year round|all year/i.test(evergreen) ? 100 : /season/i.test(evergreen) ? 55 : 70;
  const time = numberFromText(printTime);
  const printScore = time === null ? 60 : time <= 3 ? 100 : time <= 7 ? 70 : 40;
  const base = demand * 0.3 + lowCompetition * 0.2 + profit * 0.15 + personalizationScore * 0.1 + licenseSafety * 0.1 + evergreenScore * 0.1 + printScore * 0.05;
  const priorityBoost = /\bhigh|highest|top|s\b|a\b|priority\b/i.test(priority) ? 10 : 0;
  const statusBoost = /\bready to print|ready to design|ready to verify|draft ready|print next\b/i.test(status) ? 8 : 0;
  const confidenceAdjustment = confidence === null ? 0 : Math.max(-10, Math.min(10, (confidence - 70) / 3));
  return Math.max(0, Math.min(100, base + priorityBoost + statusBoost + confidenceAdjustment));
}

function spreadsheetRefFromInput(value: string) {
  const trimmed = value.trim();
  const idMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  const gidMatch = trimmed.match(/[?&#]gid=([0-9]+)/);
  return { id: idMatch?.[1] || trimmed, gid: gidMatch?.[1] || "" };
}

function opportunityScore(report: EtsyTrendReport) {
  const notesScore = numberFromText(report.source_notes || "");
  if (notesScore !== null) return notesScore;
  const priceScore = parseOpportunityPrice(report.recommended_listing.price);
  return priceScore || 0;
}

async function uniqueProductSlug(baseSlug: string, supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>) {
  const base = (baseSlug || "printz-product-opportunity").slice(0, 190);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const slug = attempt ? `${base}-${attempt + 1}` : base;
    const { data } = await supabase.from("products").select("id").eq("slug", slug).maybeSingle();
    if (!data) return slug;
  }
  return `${base}-${Date.now()}`;
}

function normalizeProductCategory(value: string) {
  const text = value.toLowerCase();
  const exact = categories.find((category) => category.toLowerCase() === text);
  if (exact) return exact;
  if (text.includes("digital") || text.includes("download") || text.includes("printable")) return "Digital Products";
  if (text.includes("desk") || text.includes("office") || text.includes("teacher")) return "Desk Accessories";
  if (text.includes("decor") || text.includes("home") || text.includes("wall")) return "Decor";
  if (text.includes("custom") || text.includes("personal")) return "Custom Orders";
  if (text.includes("gift") || text.includes("collect")) return "Collectibles";
  return "Functional Prints";
}

function parseOpportunityPrice(value?: string) {
  const parsed = Number(String(value || "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function summarizeOpportunity(value: string) {
  const clean = cleanOpportunityText(value);
  if (clean.length <= 240) return clean;
  return `${clean.slice(0, 237).trim()}...`;
}

function cleanOpportunityText(value?: string) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function sourceUrlFromReport(report: EtsyTrendReport) {
  const text = `${report.source_notes || ""} ${report.summary || ""}`;
  return text.match(/https?:\/\/[^\s)]+/i)?.[0] || "";
}

function opportunityTags(report: EtsyTrendReport, listing: EtsyTrendRecommendedListing, category: string) {
  return normalizeStringArray([
    (listing.title || "").split(/\s+/).slice(0, 4).join(" "),
    category,
    ...(report.top_trends || []).slice(0, 4),
    ...(report.listing_ideas || []).slice(0, 4),
    "3d printed",
    "custom gift",
    "made to order",
  ]).map((tag) => tag.toLowerCase().slice(0, 20)).slice(0, 13);
}

function isMissingColumnError(error: unknown) {
  const message = error && typeof error === "object" && "message" in error ? String(error.message) : "";
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  return code === "PGRST204" || code === "42703" || /column .* does not exist|schema cache/i.test(message);
}

function extractResponseText(result: {
  output?: Array<{ content?: Array<{ text?: string; type?: string }> }>;
}) {
  return result.output
    ?.flatMap((item) => item.content || [])
    .map((content) => content.text || "")
    .join("\n")
    .trim();
}

function parseAiDraft(text: string): AiListingDraft | null {
  const jsonText = text.match(/\{[\s\S]*\}/)?.[0] || text;

  try {
    const parsed = JSON.parse(jsonText) as Partial<AiListingDraft>;
    const name = String(parsed.name || "").trim();
    if (!name) return null;

    return {
      name,
      slug: String(parsed.slug || slugify(name)).trim(),
      short_description: String(parsed.short_description || "").trim(),
      full_description: String(parsed.full_description || "").trim(),
      category: String(parsed.category || "Custom Orders").trim(),
      price: String(parsed.price || "").trim(),
      etsy_url: String(parsed.etsy_url || "").trim(),
      main_image_url: String(parsed.main_image_url || "").trim(),
      video_url: String(parsed.video_url || "").trim(),
      gallery_media_urls: Array.isArray(parsed.gallery_media_urls)
        ? parsed.gallery_media_urls.join("\n")
        : String(parsed.gallery_media_urls || "").trim(),
      materials: String(parsed.materials || "").trim(),
      dimensions: String(parsed.dimensions || "").trim(),
      customization_notes: String(parsed.customization_notes || "").trim(),
      personalization_enabled: Boolean(parsed.personalization_enabled),
      personalization_prompt: String(parsed.personalization_prompt || "").trim(),
      color_options: Array.isArray(parsed.color_options)
        ? parsed.color_options.join(", ")
        : String(parsed.color_options || "").trim(),
      size_options: Array.isArray(parsed.size_options)
        ? parsed.size_options.join(", ")
        : String(parsed.size_options || "").trim(),
      finish_options: Array.isArray(parsed.finish_options)
        ? parsed.finish_options.join(", ")
        : String(parsed.finish_options || "").trim(),
      processing_time: String(parsed.processing_time || "").trim(),
      care_instructions: String(parsed.care_instructions || "").trim(),
      source_url: String(parsed.source_url || "").trim(),
      license_notes: String(parsed.license_notes || "").trim(),
      tags: Array.isArray(parsed.tags)
        ? parsed.tags.join(", ")
        : String(parsed.tags || "").trim(),
      featured: Boolean(parsed.featured),
      active: parsed.active !== false,
    };
  } catch {
    return null;
  }
}

type EtsyAutofillDraft = {
  price: string;
  short_description: string;
  full_description: string;
  materials: string;
  dimensions: string;
  tags: string;
  processing_time: string;
  care_instructions: string;
  customization_notes: string;
  personalization_enabled: boolean;
  personalization_prompt: string;
  color_options: string;
  size_options: string;
  finish_options: string;
  license_notes: string;
};

function parseEtsyAutofillDraft(text: string): EtsyAutofillDraft | null {
  const jsonText = text.match(/\{[\s\S]*\}/)?.[0] || text;

  try {
    const parsed = JSON.parse(jsonText) as Partial<EtsyAutofillDraft>;
    return {
      price: String(parsed.price || "").trim(),
      short_description: String(parsed.short_description || "").trim(),
      full_description: String(parsed.full_description || "").trim(),
      materials: String(parsed.materials || "").trim(),
      dimensions: String(parsed.dimensions || "").trim(),
      tags: normalizeStringArray(String(parsed.tags || "").split(",")).slice(0, 13).join(", "),
      processing_time: String(parsed.processing_time || "").trim(),
      care_instructions: String(parsed.care_instructions || "").trim(),
      customization_notes: String(parsed.customization_notes || "").trim(),
      personalization_enabled: Boolean(parsed.personalization_enabled),
      personalization_prompt: String(parsed.personalization_prompt || "").trim(),
      color_options: normalizeStringArray(String(parsed.color_options || "").split(",")).join(", "),
      size_options: normalizeStringArray(String(parsed.size_options || "").split(",")).join(", "),
      finish_options: normalizeStringArray(String(parsed.finish_options || "").split(",")).join(", "),
      license_notes: String(parsed.license_notes || "").trim(),
    };
  } catch {
    return null;
  }
}

function buildLocalEtsyAutofillDraft(product: Product, research: Record<string, unknown> | null): EtsyAutofillDraft {
  const name = product.name;
  const category = product.category || researchText(research, "Category") || "3D printed product";
  const primaryKeyword = researchText(research, "Primary Keyword") || (product.tags || [])[0] || name;
  const launchNotes = researchText(research, "Launch Notes");
  const sourceUrl = product.source_url || researchText(research, "Source URL");
  const suggestedPrice =
    product.price ||
    numberFromText(researchText(research, "Suggested Price")) ||
    numberFromText(researchText(research, "Price")) ||
    defaultPriceForCategory(category);
  const materials = product.materials || researchText(research, "Materials") || materialForProduct(name, category);
  const dimensions =
    product.dimensions ||
    researchText(research, "Dimensions") ||
    "Custom sizes available; confirm final dimensions before ordering.";
  const colors =
    normalizeStringArray([...(product.color_options || []), ...splitList(researchText(research, "Color Options"))]).join(", ") ||
    "White, Black, Red, Pink, Blue, Green";
  const sizes =
    normalizeStringArray([...(product.size_options || []), ...splitList(researchText(research, "Size Options"))]).join(", ") ||
    "Standard";
  const finishes =
    normalizeStringArray([...(product.finish_options || []), ...splitList(researchText(research, "Finish Options"))]).join(", ") ||
    "Standard";
  const tags = localEtsyTags(product, research, primaryKeyword, category);
  const buyerUseCase = buyerUseCaseForProduct(name, category, primaryKeyword);
  const included = includedForProduct(name, category);
  const buyerExpectation =
    "Each item is made to order, so small layer lines and minor surface variation are normal for 3D printed products.";
  const rightsNote = sourceUrl
    ? "Source model/listing is attached for admin review. Confirm commercial-use rights, attribution, and any modification rules before publishing or selling."
    : "No third-party source is attached. Confirm this is an original PRINTZ design or that commercial selling rights are documented before publishing.";
  const customization = product.customization_notes || launchNotes || customizationForProduct(name, category);

  return {
    price: suggestedPrice.toFixed(2),
    short_description:
      product.short_description && product.short_description.length > 70
        ? product.short_description
        : `${name} for ${buyerUseCase}. Made to order with practical options for color, size, and finish.`,
    full_description: [
      `${name} is a made-to-order ${category.toLowerCase()} designed for ${buyerUseCase}.`,
      `Included: ${included}`,
      `Sizing: ${dimensions}`,
      `Materials and finish: ${materials}. Available options include ${colors} colors, ${sizes} sizing, and ${finishes} finish choices.`,
      `Customization: ${customization}`,
      `Buyer expectations: ${buyerExpectation}`,
      rightsNote,
    ].join("\n\n"),
    materials,
    dimensions,
    tags: tags.join(", "),
    processing_time: product.processing_time || "Made to order in 2-4 business days",
    care_instructions:
      product.care_instructions ||
      "Keep away from high heat and direct heat sources. Clean gently with a dry or slightly damp cloth. Do not put 3D printed items in a dishwasher unless the listing explicitly says they are dishwasher safe.",
    customization_notes: customization,
    personalization_enabled: Boolean(product.personalization_enabled || customization.toLowerCase().includes("personal")),
    personalization_prompt:
      product.personalization_prompt ||
      "Enter personalization text, color preference, size request, or custom notes if offered.",
    color_options: colors,
    size_options: sizes,
    finish_options: finishes,
    license_notes: product.license_notes || researchText(research, "License Notes") || rightsNote,
  };
}

function buildEtsyAutofillPatch(product: Product, draft: EtsyAutofillDraft) {
  const patch: Record<string, unknown> = {};
  const price = Number(String(draft.price).replace(/[^0-9.]/g, ""));
  const tags = normalizeStringArray(draft.tags.split(",")).slice(0, 13);
  const colorOptions = normalizeStringArray(draft.color_options.split(","));
  const sizeOptions = normalizeStringArray(draft.size_options.split(","));
  const finishOptions = normalizeStringArray(draft.finish_options.split(","));

  if ((!product.price || product.price <= 0) && Number.isFinite(price) && price > 0) patch.price = price;
  if (isWeakText(product.short_description, 70) && draft.short_description) patch.short_description = draft.short_description.slice(0, 280);
  if (isWeakText(product.full_description, 240) && draft.full_description) patch.full_description = draft.full_description.slice(0, 5000);
  if (isWeakText(product.materials, 12) && draft.materials) patch.materials = draft.materials.slice(0, 1000);
  if (isWeakText(product.dimensions, 12) && draft.dimensions) patch.dimensions = draft.dimensions.slice(0, 1000);
  if ((product.tags || []).length < 8 && tags.length >= 5) patch.tags = tags;
  if (isWeakText(product.processing_time, 10) && draft.processing_time) patch.processing_time = draft.processing_time.slice(0, 500);
  if (isWeakText(product.care_instructions, 20) && draft.care_instructions) patch.care_instructions = draft.care_instructions.slice(0, 1500);
  if (isWeakText(product.customization_notes, 30) && draft.customization_notes) patch.customization_notes = draft.customization_notes.slice(0, 1500);
  if (!product.personalization_prompt && draft.personalization_prompt) patch.personalization_prompt = draft.personalization_prompt.slice(0, 1000);
  if (!product.personalization_enabled && draft.personalization_enabled) patch.personalization_enabled = true;
  if (!product.color_options?.length && colorOptions.length) patch.color_options = colorOptions;
  if (!product.size_options?.length && sizeOptions.length) patch.size_options = sizeOptions;
  if (!product.finish_options?.length && finishOptions.length) patch.finish_options = finishOptions;
  if (isWeakText(product.license_notes, 20) && draft.license_notes) patch.license_notes = draft.license_notes.slice(0, 2000);

  return patch;
}

function isWeakText(value: string | null | undefined, minLength: number) {
  const text = String(value || "").trim();
  if (!text) return true;
  if (text.length < minLength) return true;
  return /\b(confirm|tbd|todo|unknown|add details|see details|price on request|pending source|source model|opportunity draft|product opportunity|to be finalized|after source|after the source|final care notes)\b/i.test(text);
}

function researchText(research: Record<string, unknown> | null, key: string) {
  return String(research?.[key] || "").trim();
}

function numberFromText(value: string) {
  const number = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(number) && number > 0 ? number : null;
}

function splitList(value: string) {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function defaultPriceForCategory(category: string) {
  const normalized = category.toLowerCase();
  if (normalized.includes("digital") || normalized.includes("printable")) return 4.99;
  if (normalized.includes("decor") || normalized.includes("gift")) return 19.99;
  if (normalized.includes("desk") || normalized.includes("organizer")) return 14.99;
  return 12.99;
}

function materialForProduct(name: string, category: string) {
  const text = `${name} ${category}`.toLowerCase();
  if (text.includes("cookie") || text.includes("food")) {
    return "PLA or PETG; use a food-contact-safe production process only if marketed for food use.";
  }
  if (text.includes("lamp")) return "PLA or PETG printed shell; lighting hardware only if explicitly included in the final listing.";
  if (text.includes("wall") || text.includes("shelf") || text.includes("hook")) return "PLA or PETG; mounting hardware is not included unless selected.";
  return "PLA or PETG 3D printed plastic.";
}

function localEtsyTags(product: Product, research: Record<string, unknown> | null, primaryKeyword: string, category: string) {
  const base = [
    primaryKeyword,
    ...(product.tags || []),
    ...splitList(researchText(research, "Tags")),
    category,
    "3d printed",
    "custom gift",
    "personalized gift",
    "desk accessory",
    "home organizer",
    "made to order",
    "teacher gift",
    "unique gift",
    "functional print",
  ];

  return normalizeStringArray(base)
    .map((tag) => tag.toLowerCase().replace(/\s+/g, " ").trim())
    .filter((tag) => tag.length <= 20)
    .slice(0, 13);
}

function buyerUseCaseForProduct(name: string, category: string, primaryKeyword: string) {
  const text = `${name} ${category} ${primaryKeyword}`.toLowerCase();
  if (text.includes("cookie")) return "baking, party favors, classroom rewards, seasonal gifts, and personalized treats";
  if (text.includes("lamp")) return "personalized room decor, nightstand styling, gifts, and custom photo keepsakes";
  if (text.includes("pet")) return "pet owners, feeding stations, gift baskets, and personalized daily routines";
  if (text.includes("shelf")) return "wall storage, display setups, small-space organization, and custom room decor";
  if (text.includes("controller") || text.includes("gaming")) return "gaming desks, controller storage, entertainment centers, and gamer gifts";
  if (text.includes("vase") || text.includes("planter")) return "home decor, desk styling, shelf displays, gifts, and seasonal arrangements";
  return "gifting, desk setups, home organization, and custom functional use";
}

function includedForProduct(name: string, category: string) {
  const text = `${name} ${category}`.toLowerCase();
  if (text.includes("set")) return "one made-to-order set as described, with selected color/size options confirmed before production.";
  if (text.includes("lamp")) return "one printed lamp body or custom lamp component as configured; electronics are included only when explicitly selected.";
  if (text.includes("shelf") || text.includes("wall")) return "one printed item; mounting hardware is not included unless the listing says otherwise.";
  return "one made-to-order 3D printed item with the selected options.";
}

function customizationForProduct(name: string, category: string) {
  const text = `${name} ${category}`.toLowerCase();
  if (text.includes("cookie") || text.includes("personal") || text.includes("custom")) {
    return "Personalization can include requested text, initials, color, size, or simple custom notes when offered.";
  }
  return "Choose available color, size, and finish options. Message before ordering for custom sizing or special requests.";
}

async function getProductSheetResearch(product: Product) {
  const spreadsheetId = process.env.PRINTZ_PRODUCT_SHEET_ID || "14L2liBREJYQSO_rhaAon_1RXonZIah91y77f4T3ctXs";
  const sheets = new GoogleSheetsClient({ spreadsheetId, env: process.env });
  const rows = await sheets.getValues("'Product Intake'!A1:AH1000");
  const [headers, ...body] = rows as string[][];
  if (!headers?.length) return null;
  const normalizedHeaders = headers.map((header) => String(header || "").trim());
  const nameIndex = normalizedHeaders.indexOf("Name");
  if (nameIndex < 0) return null;

  const normalizedProductName = normalizeLookupText(product.name);
  const normalizedSlugName = normalizeLookupText(product.slug);
  const match = body.find((row) => {
    const candidate = normalizeLookupText(row[nameIndex]);
    return candidate && (candidate === normalizedProductName || candidate === normalizedSlugName);
  });

  if (!match) return null;

  return Object.fromEntries(
    normalizedHeaders.map((header, index) => [header, match[index] ?? ""]).filter(([header, value]) => header && value),
  );
}

function normalizeLookupText(value: unknown) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function parseAiScout(text: string): Omit<AiScoutState, "ok" | "message" | "errors"> | null {
  const jsonText = text.match(/\{[\s\S]*\}/)?.[0] || text;

  try {
    const parsed = JSON.parse(jsonText) as {
      answer?: string;
      viability_score?: number;
      rights_risk?: string;
      rights_notes?: string;
      sources_to_check?: unknown;
      draft?: Partial<AiListingDraft>;
    };
    const draft = parseAiDraft(JSON.stringify(parsed.draft || {}));
    if (!parsed.answer && !draft) return null;

    return {
      answer: String(parsed.answer || "").trim(),
      viabilityScore: Number(parsed.viability_score || 0),
      rightsRisk: String(parsed.rights_risk || "Medium").trim(),
      rightsNotes: String(parsed.rights_notes || "").trim(),
      sourcesToCheck: normalizeStringArray(parsed.sources_to_check),
      draft: draft || undefined,
    };
  } catch {
    return null;
  }
}

function parseMarketResearchReport(text: string, fallbackDate: string): AiMarketResearchReport | null {
  const jsonText = text.match(/\{[\s\S]*\}/)?.[0] || text;

  try {
    const parsed = JSON.parse(jsonText) as Partial<AiMarketResearchReport>;
    const title = String(parsed.title || "").trim();
    const summary = String(parsed.summary || "").trim();
    if (!title || !summary) return null;

    const listing = parsed.recommended_listing || {};
    return {
      report_date: String(parsed.report_date || fallbackDate).trim(),
      title,
      summary,
      top_trends: normalizeStringArray(parsed.top_trends),
      listing_ideas: normalizeStringArray(parsed.listing_ideas),
      recommended_listing: {
        title: String(listing.title || "").trim(),
        product_type: String(listing.product_type || "").trim(),
        price: String(listing.price || "").trim(),
        category: String(listing.category || "").trim(),
        tags: normalizeStringArray(listing.tags),
        description: String(listing.description || "").trim(),
        files_or_variants: String(listing.files_or_variants || "").trim(),
        photo_plan: String(listing.photo_plan || "").trim(),
        next_steps: String(listing.next_steps || "").trim(),
      },
      source_notes: String(parsed.source_notes || "AI-generated market research with web search. Review before acting.").trim(),
    };
  } catch {
    return null;
  }
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function todayInNewYork() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

export async function syncProductToEtsyListing(state: EtsyDraftState, formData: FormData): Promise<EtsyDraftState> {
  void state;
  if (!(await assertAdmin())) return failure("Unauthorized.");
  const productId = textFromForm(formData, "product_id");
  if (!productId) return failure("Missing product id.");
  return syncProductToAttachedEtsyListing(productId, formData.get("publish") === "on");
}

async function syncProductToAttachedEtsyListing(productId: string, publish: boolean): Promise<EtsyDraftState> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return failure("Supabase service role key is required.");

  const [{ data, error }, mediaResult] = await Promise.all([
    supabase.from("products").select("*").eq("id", productId).maybeSingle(),
    supabase.from("product_media").select("*").eq("product_id", productId).order("sort_order", { ascending: true }),
  ]);
  if (error) return failure(error.message);
  if (!data) return failure("Product not found.");

  const product = data as Product;
  const media = (mediaResult.data || []) as ProductMedia[];
  const [etsyToken, etsySettings] = await Promise.all([getValidEtsyOAuthToken(), getEffectiveEtsyRuntimeSettings()]);
  const missing = etsyListingRequirements(product, { hasOAuthToken: Boolean(etsyToken?.access_token), settings: etsySettings });
  if (missing.length) return failure(`Etsy sync needs these settings first: ${missing.join(", ")}.`);

  try {
    const result = await createOrSyncEtsyListing({
      apiKey: process.env.ETSY_API_KEY!,
      accessToken: etsyToken?.access_token || process.env.ETSY_ACCESS_TOKEN!,
      settings: etsySettings,
      product,
      media,
      publish,
    });

    await supabase.from("products").update({
      etsy_listing_id: result.listingId,
      etsy_url: result.url,
      etsy_state: result.state,
      active: true,
      updated_at: new Date().toISOString(),
    }).eq("id", product.id);

    revalidatePath("/");
    revalidatePath("/products");
    revalidatePath("/admin");
    revalidatePath("/admin/etsy");
    revalidatePath(`/admin/products/${product.id}`);

    return {
      ok: true,
      message: `${result.recreatedDraft ? "Saved Etsy listing was missing, so a new draft was created. " : ""}${publish ? "Published/synced" : "Synced"} Etsy listing ${result.listingId}. Uploaded ${result.uploadedImages} new image${result.uploadedImages === 1 ? "" : "s"}.`,
      listingUrl: result.url,
      uploadedImages: result.uploadedImages,
    };
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Could not sync Etsy listing.");
  }
}
export async function importProductsFromCsv(state: ActionState, formData: FormData): Promise<ActionState> {
  void state;
  if (!(await assertAdmin())) return failure("Unauthorized.");

  const file = formData.get("product_import_file");
  if (!(file instanceof File) || file.size === 0) return failure("Upload a CSV file exported from the product import template.");

  const supabase = createSupabaseAdminClient();
  if (!supabase) return failure("Supabase service role key is required for product import.");

  const result = await importProductsCsvText(await file.text(), supabase);
  const spreadsheetId = optionalTextFromForm(formData, "source_spreadsheet_id");
  const sheetName = optionalTextFromForm(formData, "source_sheet_name");
  let writebackMessage = "";
  if (spreadsheetId && sheetName && result.writebacks.length) {
    try {
      const written = await writeProductImportResultsToSheet(spreadsheetId, sheetName, result.writebacks);
      writebackMessage = written ? ` Wrote ${written} row${written === 1 ? "" : "s"} back to ${sheetName}.` : ` No Sheet writeback columns were found on ${sheetName}.`;
    } catch (error) {
      writebackMessage = ` Sheet writeback failed: ${error instanceof Error ? error.message : "Unknown Sheets error"}.`;
    }
  }

  revalidatePath("/");
  revalidatePath("/products");
  revalidatePath("/admin");

  const summary = `Import complete: ${result.created} created, ${result.updated} updated, ${result.mediaImported} Drive media folder${result.mediaImported === 1 ? "" : "s"} imported.${writebackMessage}`;
  return result.errors.length
    ? failure(`${summary} ${result.errors.slice(0, 5).join(" ")}${result.errors.length > 5 ? ` (${result.errors.length - 5} more errors)` : ""}`)
    : success(summary);
}

async function writeProductImportResultsToSheet(
  spreadsheetId: string,
  sheetName: string,
  writebacks: Awaited<ReturnType<typeof importProductsCsvText>>["writebacks"],
) {
  const sheets = new GoogleSheetsClient({ spreadsheetId });
  const quotedSheetName = quoteSheetName(sheetName);
  const headerRows = await sheets.getValues(`${quotedSheetName}!1:1`);
  const headers = (headerRows[0] || []).map((value: unknown) => normalizeSheetHeader(String(value || "")));
  const outputHeaders = ["import_status", "product_id", "site_url", "media_status", "ai_suggested_price", "ai_price_notes", "imported_at"];
  let rowsWithWriteback = 0;
  const ranges = writebacks.flatMap((writeback) => {
    const valuesByHeader: Record<string, string> = {
      import_status: writeback.status,
      product_id: writeback.productId,
      site_url: writeback.siteUrl,
      media_status: writeback.mediaStatus,
      ai_suggested_price: writeback.aiSuggestedPrice,
      ai_price_notes: writeback.aiPriceNotes,
      imported_at: writeback.importedAt,
    };

    const rowRanges = outputHeaders.flatMap((header) => {
      const columnIndex = headers.indexOf(header);
      if (columnIndex < 0) return [];
      return [{ range: `${quotedSheetName}!${columnLetter(columnIndex + 1)}${writeback.rowNumber}`, values: [[valuesByHeader[header] || ""]] }];
    });
    if (rowRanges.length) rowsWithWriteback++;
    return rowRanges;
  });

  await sheets.batch(ranges);
  return rowsWithWriteback;
}

function quoteSheetName(sheetName: string) {
  return `'${sheetName.replaceAll("'", "''")}'`;
}

function normalizeSheetHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function columnLetter(index: number) {
  let column = "";
  while (index > 0) {
    const remainder = (index - 1) % 26;
    column = String.fromCharCode(65 + remainder) + column;
    index = Math.floor((index - 1) / 26);
  }
  return column;
}

export async function deactivateAllProducts(state: ActionState): Promise<ActionState> {
  void state;
  if (!(await assertAdmin())) return failure("Unauthorized.");

  const supabase = createSupabaseAdminClient();
  if (!supabase) return failure("Supabase service role key is required.");

  const { error } = await supabase
    .from("products")
    .update({ active: false, featured: false, updated_at: new Date().toISOString() })
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) return failure(error.message);

  revalidatePath("/");
  revalidatePath("/products");
  revalidatePath("/admin");
  return success("All products are now inactive and unfeatured.");
}
