"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { contactSchema, productSchema, suggestionSchema } from "@/lib/schemas";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { isApprovedAdmin } from "@/lib/auth";
import { getAllowedAdminEmails } from "@/lib/config";
import { createEtsyDraftFromProduct, etsyDraftRequirements } from "@/lib/etsy-drafts";
import { getEffectiveEtsyRuntimeSettings, getValidEtsyOAuthToken, setEtsyRuntimeSettings } from "@/lib/etsy-auth";
import { syncEtsyListings } from "@/lib/etsy-sync";
import type { Product } from "@/lib/types";
import { optionalTextFromForm, slugify, textFromForm } from "@/lib/utils";

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
};

export type EtsyDraftState = ActionState & {
  listingUrl?: string;
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
    source_url: textFromForm(formData, "source_url"),
    license_notes: textFromForm(formData, "license_notes"),
    tags: textFromForm(formData, "tags"),
    featured: formData.get("featured") === "on",
    active: formData.get("active") === "on",
  });

  return parsed;
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

export async function createProduct(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await assertAdmin())) return failure("Unauthorized.");

  const parsed = parseProductForm(formData);
  if (!parsed.success) {
    return failure("Please fix the product fields.", parsed.error.flatten().fieldErrors);
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) return failure("Supabase service role key is required for admin product management.");

  const { data, error } = await supabase.from("products").insert(parsed.data).select("id").single();
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

  const { error } = await supabase
    .from("products")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return failure(error.message);
  await syncProductMedia(id, formData, supabase);

  revalidatePath("/");
  revalidatePath("/products");
  revalidatePath("/admin");
  redirect("/admin");
}

export async function deleteProduct(formData: FormData) {
  if (!(await assertAdmin())) return;

  const id = textFromForm(formData, "id");
  const supabase = createSupabaseAdminClient();
  if (id && supabase) {
    await supabase.from("products").delete().eq("id", id);
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
    const result = await syncEtsyListings();
    revalidatePath("/");
    revalidatePath("/products");
    revalidatePath("/admin");
    revalidatePath("/admin/etsy");

    return result.ok ? success(result.message) : failure(result.message);
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Etsy sync failed.");
  }
}

export async function saveEtsyRuntimeSettings(state: ActionState, formData: FormData): Promise<ActionState> {
  void state;

  if (!(await assertAdmin())) return failure("Unauthorized.");

  const settings = {
    shopId: textFromForm(formData, "shop_id"),
    taxonomyId: textFromForm(formData, "taxonomy_id"),
    shippingProfileId: optionalTextFromForm(formData, "shipping_profile_id") || "",
    readinessStateId: optionalTextFromForm(formData, "readiness_state_id") || "",
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

  const openAiKey = process.env.OPENAI_API_KEY;
  if (!openAiKey) {
    return failure("OPENAI_API_KEY is not configured.");
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
    const result = await createOpenAiResponse(openAiKey, {
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

export async function generateAiScoutListing(_: AiScoutState, formData: FormData): Promise<AiScoutState> {
  if (!(await assertAdmin())) return failure("Unauthorized.");

  const openAiKey = process.env.OPENAI_API_KEY;
  if (!openAiKey) return failure("OPENAI_API_KEY is not configured.");

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
    const result = await createOpenAiResponse(openAiKey, {
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

  const openAiKey = process.env.OPENAI_API_KEY;
  if (!openAiKey) {
    return failure("OPENAI_API_KEY is not configured.");
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
    const result = await createOpenAiResponse(openAiKey, {
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

    const { error } = await supabase.from("etsy_trend_reports").insert(report);
    if (error) return failure(error.message);

    revalidatePath("/admin/trends");

    return {
      ok: true,
      message: "Market research report generated and saved to Trend reports.",
      report,
    };
  } catch (error) {
    return failure(error instanceof Error ? error.message : "AI market research failed. Please try again.");
  }
}

async function createOpenAiResponse(
  openAiKey: string,
  body: {
    model: string;
    fallbackModel?: string;
    input: string;
    max_output_tokens: number;
    tools?: Array<Record<string, unknown>>;
  },
) {
  const tryRequest = async (model: string) => {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: body.input,
        tools: body.tools,
        max_output_tokens: body.max_output_tokens,
      }),
    });

    if (response.ok) return response.json();

    const message = await response.text();
    throw new Error(`OpenAI request failed for ${model}: ${message.slice(0, 260)}`);
  };

  try {
    return await tryRequest(body.model);
  } catch (error) {
    if (!body.fallbackModel || body.fallbackModel === body.model) throw error;
    return tryRequest(body.fallbackModel);
  }
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
