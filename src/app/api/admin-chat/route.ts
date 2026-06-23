import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isApprovedAdmin } from "@/lib/auth";
import { createEtsyDraftFromProduct, etsyDraftRequirements } from "@/lib/etsy-drafts";
import { getEffectiveEtsyRuntimeSettings, getValidEtsyOAuthToken } from "@/lib/etsy-auth";
import { productSchema } from "@/lib/schemas";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Product } from "@/lib/types";
import { slugify } from "@/lib/utils";

type AdminChatListingDraft = {
  name: string;
  short_description: string;
  full_description?: string;
  category?: string;
  price?: string | number;
  main_image_url?: string;
  gallery_media_urls?: string[] | string;
  source_url?: string;
  license_notes?: string;
  rights_status?: "Safe to create ourselves" | "Needs original remake" | "Needs license/permission" | "Avoid" | string;
  tags?: string[] | string;
  materials?: string;
  dimensions?: string;
  customization_notes?: string;
  color_options?: string[] | string;
  size_options?: string[] | string;
  finish_options?: string[] | string;
  processing_time?: string;
  care_instructions?: string;
  preview_images?: Array<{ url: string; source_url?: string; label?: string }>;
  active?: boolean;
  featured?: boolean;
  etsy_url?: string;
  video_url?: string;
};

type AdminChatAction = {
  type: "update_product" | "create_etsy_draft";
  label: string;
  summary: string;
  product_id: string;
  patch?: Partial<AdminChatListingDraft>;
};

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

  if (!(await isApprovedAdmin(user?.email))) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  const openAiKey = process.env.OPENAI_API_KEY;
  if (!openAiKey) {
    return NextResponse.json({ ok: false, message: "OPENAI_API_KEY is not configured." }, { status: 500 });
  }

  const formData = await request.formData();
  const message = String(formData.get("message") || "").trim();
  const history = String(formData.get("history") || "").trim();
  const page = String(formData.get("page") || "").trim();
  const files = formData.getAll("files").filter((file): file is File => file instanceof File);
  const adminSupabase = createSupabaseAdminClient();
  const pageContext = adminSupabase ? await getAdminContext(adminSupabase, page, `${history}\n${message}`) : "";

  if (!message && !files.length) {
    return NextResponse.json({ ok: false, message: "Send a message or upload an image." }, { status: 400 });
  }

  const imageContent = await Promise.all(
    files
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, 4)
      .map(async (file) => ({
        type: "input_image",
        image_url: `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`,
      })),
  );

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_ADMIN_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini",
      max_output_tokens: 6000,
      tools: [{ type: "web_search_preview" }],
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: [
                "You are PRINTZ Admin Agent, the operating assistant for PRINTZByKhan, an Etsy shop focused on 3D printed products, classroom/teacher digital products, posters, decor, desk accessories, and custom print services.",
                "Your core job is to find and evaluate products PRINTZ can sell, especially products likely to perform on Etsy. Use web search when product scouting, market research, trend analysis, rights checks, or source review would benefit from current information.",
                "When asked to find products, produce a ranked shortlist. For each idea include: product name, buyer/niche, why it can sell, estimated Etsy price range, production/digital-delivery plan, photo plan, SEO title, 13 Etsy tags, source URL, preview image URLs when available, and next action.",
                "When asked to audit, check, review, research, or flag all current listings, you must use the provided current_shop_products context. Do not answer with generic policy advice. Produce a listing-by-listing audit with product name, status, evidence from the product fields, risk reason, and recommended admin action.",
                "Use recent conversation history. If the admin says 'ok do it', 'do it for me', 'apply that', or similar after an audit/edit plan, produce the requested action JSON now instead of asking what they mean.",
                "Rights and licensing are mandatory. Separate ideas into: Safe to create ourselves, Needs original remake, Needs license/permission, Avoid. Never say an existing MakerWorld/Printables/Etsy/Pinterest/product image/design is sellable unless its license clearly allows commercial selling and the seller verifies that source license.",
                "For 3D models, check for commercial-use permissions, remix rules, attribution requirements, brand/trademark issues, fan-art risk, and platform terms. If a model is personal-use or unclear, recommend remaking an original PRINTZ version inspired only by the broad function, not copying the design.",
                "For digital products, avoid copyrighted characters, school logos, trademarked phrases, copied worksheet/poster designs, and exact replicas. Recommend original text, layout, and artwork that PRINTZ can own.",
                "If images are uploaded, inspect them and explain what the product appears to be, likely niche, listing angle, suggested improvements, whether it looks original enough, and what must be changed before selling.",
                "Whenever you recommend a product that could become a site listing, include a JSON object at the end of the response between PRINTZ_LISTING_JSON_START and PRINTZ_LISTING_JSON_END.",
                "The JSON shape must be {\"listing_drafts\":[{\"name\":\"...\",\"short_description\":\"...\",\"full_description\":\"...\",\"category\":\"...\",\"price\":\"19.99\",\"main_image_url\":\"https://...\",\"gallery_media_urls\":[\"https://...\"],\"source_url\":\"https://...\",\"license_notes\":\"...\",\"rights_status\":\"Safe to create ourselves|Needs original remake|Needs license/permission|Avoid\",\"tags\":[\"tag1\"],\"materials\":\"...\",\"dimensions\":\"...\",\"customization_notes\":\"...\",\"color_options\":[\"Black\"],\"size_options\":[],\"finish_options\":[\"Standard\"],\"processing_time\":\"...\",\"care_instructions\":\"...\",\"preview_images\":[{\"url\":\"https://...\",\"source_url\":\"https://...\",\"label\":\"...\"}]}]}.",
                "When the admin asks you to edit, improve, rewrite, optimize, fix, or update an existing product/listing and a current product context is provided, include action JSON between PRINTZ_ACTION_JSON_START and PRINTZ_ACTION_JSON_END.",
                "Action JSON shape: {\"actions\":[{\"type\":\"update_product\",\"label\":\"Apply SEO rewrite\",\"summary\":\"What will change\",\"product_id\":\"current product id\",\"patch\":{\"name\":\"...\",\"short_description\":\"...\",\"full_description\":\"...\",\"price\":\"24.99\",\"tags\":[\"tag1\"],\"license_notes\":\"...\",\"active\":true,\"featured\":false,\"main_image_url\":\"https://...\",\"gallery_media_urls\":[\"https://...\"]}},{\"type\":\"create_etsy_draft\",\"label\":\"Create Etsy draft\",\"summary\":\"Creates a draft Etsy listing from this website product\",\"product_id\":\"product id\"}]}.",
                "When the admin asks to create an Etsy listing for a product that already exists in the app, propose a create_etsy_draft action. Do not claim it is published; Etsy API creates a draft that the admin can finish/review on Etsy.",
                "For shop-wide rights audits, include update_product actions for products that should be flagged. Do not delete products. Prefer patching license_notes with the audit finding and active:false when rights are unclear, personal-use, copied, trademarked, or need a remake.",
                "If the user specifically asks you to do it/apply it after a shop-wide audit, include action JSON even if the current page is not a product edit page.",
                "For shop-wide audits, keep the visible audit concise and put all applyable changes in one complete, minified JSON object. The JSON must be valid, must not contain literal line breaks inside string values, and must close the PRINTZ_ACTION_JSON_END marker. If there are many risky products, include actions for the riskiest 20 first.",
                "Only propose actions that are directly requested or clearly useful. Do not include destructive actions. Keep risky rights/license changes inactive unless the admin explicitly asks otherwise.",
                "Only include listing drafts for ideas worth considering. If the rights status is not Safe to create ourselves, make the draft a remake plan and clearly say what must be changed before selling.",
                "Be concise but complete. Prefer tables or tight sections. End with a concrete listing recommendation or remake plan.",
              ].join(" "),
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                `Current admin page: ${page || "unknown"}`,
                history ? `Recent conversation:\n${history}` : "",
                pageContext ? `Current admin context:\n${pageContext}` : "",
                `Admin request:\n${message || "Please analyze the uploaded image(s)."}`,
              ].filter(Boolean).join("\n\n"),
            },
            ...imageContent,
          ],
        },
      ],
    }),
  });

  const result = await response.json();
  if (!response.ok) {
    const messageText =
      typeof result?.error?.message === "string" ? result.error.message : "Admin assistant request failed.";
    return NextResponse.json({ ok: false, message: messageText }, { status: response.status });
  }

  const answer = extractResponseText(result);
  const listingDrafts = parseListingDrafts(answer || "");
  const actions = parseActions(answer || "");
  return NextResponse.json({
    ok: true,
    answer: stripMachineJson(answer || "") || "I could not produce a response. Try again with more detail.",
    listingDrafts,
    actions,
  });
}

export async function PUT(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

  if (!(await isApprovedAdmin(user?.email))) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  const adminSupabase = createSupabaseAdminClient();
  if (!adminSupabase) {
    return NextResponse.json({ ok: false, message: "Supabase service role key is required." }, { status: 500 });
  }

  const body = (await request.json()) as { draft?: AdminChatListingDraft; action?: AdminChatAction };

  if (body.action?.type === "update_product") {
    const result = await updateProductFromAction(adminSupabase, body.action);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  }

  if (body.action?.type === "create_etsy_draft") {
    const result = await createEtsyDraftFromAction(adminSupabase, body.action);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  }

  const draft = body.draft;
  if (!draft?.name || !draft.short_description) {
    return NextResponse.json({ ok: false, message: "Missing listing draft fields." }, { status: 400 });
  }

  const rightsStatus = String(draft.rights_status || "Needs original remake");
  const safeToPublish = rightsStatus === "Safe to create ourselves";
  const galleryUrls = normalizeStringList(draft.gallery_media_urls);
  const previewUrls = (draft.preview_images || []).map((image) => image.url).filter(Boolean);
  const mediaUrls = Array.from(new Set([draft.main_image_url || "", ...galleryUrls, ...previewUrls].filter(Boolean)));

  const parsed = productSchema.safeParse({
    name: draft.name,
    slug: slugify(draft.name),
    short_description: draft.short_description,
    full_description: draft.full_description || draft.short_description,
    category: draft.category || "AI Product Drafts",
    price: draft.price === undefined || draft.price === null ? "" : String(draft.price),
    etsy_url: "",
    main_image_url: draft.main_image_url || mediaUrls[0] || "",
    video_url: "",
    materials: draft.materials || "",
    dimensions: draft.dimensions || "",
    customization_notes: draft.customization_notes || "",
    personalization_enabled: Boolean(draft.customization_notes),
    personalization_prompt: draft.customization_notes || "",
    color_options: normalizeStringList(draft.color_options).join(", "),
    size_options: normalizeStringList(draft.size_options).join(", "),
    finish_options: normalizeStringList(draft.finish_options).join(", "),
    processing_time: draft.processing_time || "",
    care_instructions: draft.care_instructions || "",
    source_url: draft.source_url || "",
    license_notes: [rightsStatus, draft.license_notes].filter(Boolean).join(" - "),
    tags: normalizeStringList(draft.tags).slice(0, 13).join(", "),
    featured: false,
    active: safeToPublish,
  });

  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "The AI draft is missing required product fields." }, { status: 400 });
  }

  const { data, error } = await adminSupabase.from("products").insert(parsed.data).select("id, slug").single();
  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  const mediaRows = mediaUrls.slice(0, 10).map((url, index) => ({
    product_id: data.id,
    media_type: /\.(mp4|mov|webm|m4v)$/i.test(url) ? "video" : "image",
    url,
    sort_order: index,
  }));
  if (mediaRows.length) await adminSupabase.from("product_media").insert(mediaRows);

  revalidatePath("/");
  revalidatePath("/products");
  revalidatePath("/admin");

  return NextResponse.json({
    ok: true,
    message: safeToPublish
      ? "Created an active website listing."
      : "Created an inactive website draft because the rights status needs review or remake work.",
    productId: data.id,
    editUrl: `/admin/products/${data.id}`,
    publicUrl: `/products/${data.slug}`,
  });
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

function parseListingDrafts(answer: string) {
  const match = answer.match(/PRINTZ_LISTING_JSON_START\s*([\s\S]*?)\s*PRINTZ_LISTING_JSON_END/);
  if (!match) return [];

  try {
    const parsed = JSON.parse(match[1]) as { listing_drafts?: AdminChatListingDraft[] };
    return Array.isArray(parsed.listing_drafts) ? parsed.listing_drafts.slice(0, 5) : [];
  } catch {
    return [];
  }
}

function parseActions(answer: string) {
  const match = answer.match(/PRINTZ_ACTION_JSON_START\s*([\s\S]*?)\s*PRINTZ_ACTION_JSON_END/);
  if (!match) return [];

  try {
    const parsed = JSON.parse(match[1]) as { actions?: AdminChatAction[] };
    return Array.isArray(parsed.actions)
      ? parsed.actions.filter((action) => action.type === "update_product" || action.type === "create_etsy_draft").slice(0, 25)
      : [];
  } catch {
    return [];
  }
}

function stripMachineJson(answer: string) {
  return answer
    .replace(/PRINTZ_LISTING_JSON_START[\s\S]*?PRINTZ_LISTING_JSON_END/g, "")
    .replace(/PRINTZ_ACTION_JSON_START[\s\S]*?PRINTZ_ACTION_JSON_END/g, "")
    .trim();
}

function normalizeStringList(value: unknown) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(/\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

async function getAdminContext(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  page: string,
  message: string,
) {
  if (needsShopWideContext(message)) {
    return getShopWideProductContext(supabase);
  }

  return getAdminPageContext(supabase, page);
}

function needsShopWideContext(message: string) {
  const normalized = message.toLowerCase();
  return (
    /\b(all|current|every|shop[- ]?wide|entire shop|our listings|current listings)\b/.test(normalized) &&
    /\b(rights?|license|licensing|ip|copyright|trademark|sell|selling|audit|flag|compliance|policy)\b/.test(normalized)
  );
}

async function getShopWideProductContext(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
) {
  const [{ data: products }, { data: media }] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id,name,slug,short_description,full_description,category,price,etsy_url,main_image_url,video_url,source_url,license_notes,tags,active,featured,etsy_listing_id,etsy_state,synced_from_etsy_at,created_at,updated_at",
      )
      .order("updated_at", { ascending: false })
      .limit(80),
    supabase.from("product_media").select("product_id,media_type,url,sort_order").order("sort_order", { ascending: true }).limit(800),
  ]);

  const mediaByProduct = ((media || []) as Array<{ product_id: string; media_type: string; url: string; sort_order: number }>).reduce<
    Record<string, Array<{ media_type: string; url: string; sort_order: number }>>
  >((groups, item) => {
    groups[item.product_id] = [...(groups[item.product_id] || []), item];
    return groups;
  }, {});

  return JSON.stringify(
    {
      audit_instruction:
        "Audit these current website products one by one. Use source_url, license_notes, titles, descriptions, tags, image URLs, and Etsy sync data as evidence. Flag anything with unclear rights, missing license notes for sourced models, copied marketplace images, trademark/fan-art risk, or personal-use risk. Return action JSON to set active:false and append license_notes for risky products.",
      current_shop_products: (products || []).map((product) => ({
        ...product,
        media: mediaByProduct[product.id] || [],
      })),
    },
    null,
    2,
  );
}

async function getAdminPageContext(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  page: string,
) {
  const productId = page.match(/^\/admin\/products\/([^/?#]+)/)?.[1];
  if (!productId || productId === "new") return "";

  const [{ data: product }, { data: media }] = await Promise.all([
    supabase.from("products").select("*").eq("id", productId).maybeSingle(),
    supabase.from("product_media").select("*").eq("product_id", productId).order("sort_order", { ascending: true }),
  ]);
  if (!product) return "";

  return JSON.stringify(
    {
      current_product: product,
      current_media: media || [],
      editable_fields: [
        "name",
        "short_description",
        "full_description",
        "category",
        "price",
        "main_image_url",
        "gallery_media_urls",
        "etsy_url",
        "video_url",
        "materials",
        "dimensions",
        "customization_notes",
        "color_options",
        "size_options",
        "finish_options",
        "processing_time",
        "care_instructions",
        "source_url",
        "license_notes",
        "tags",
        "featured",
        "active",
      ],
    },
    null,
    2,
  );
}

async function updateProductFromAction(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  action: AdminChatAction,
) {
  if (!action.product_id || !action.patch) return { ok: false, message: "Missing product edit details." };

  const { data: current, error: currentError } = await supabase
    .from("products")
    .select("*")
    .eq("id", action.product_id)
    .maybeSingle();
  if (currentError) return { ok: false, message: currentError.message };
  if (!current) return { ok: false, message: "Product not found." };

  const patch = action.patch;
  const mediaUrls = normalizeStringList(patch.gallery_media_urls);
  const parsed = productSchema.safeParse({
    name: patch.name ?? current.name,
    slug: current.slug,
    short_description: patch.short_description ?? current.short_description,
    full_description: patch.full_description ?? current.full_description ?? "",
    category: patch.category ?? current.category,
    price: patch.price === undefined || patch.price === null ? String(current.price ?? "") : String(patch.price),
    etsy_url: patch.etsy_url ?? current.etsy_url ?? "",
    main_image_url: patch.main_image_url ?? current.main_image_url ?? "",
    video_url: patch.video_url ?? current.video_url ?? "",
    materials: patch.materials ?? current.materials ?? "",
    dimensions: patch.dimensions ?? current.dimensions ?? "",
    customization_notes: patch.customization_notes ?? current.customization_notes ?? "",
    personalization_enabled: Boolean(current.personalization_enabled || patch.customization_notes),
    personalization_prompt: current.personalization_prompt ?? "",
    color_options: patch.color_options ? normalizeStringList(patch.color_options).join(", ") : (current.color_options || []).join(", "),
    size_options: patch.size_options ? normalizeStringList(patch.size_options).join(", ") : (current.size_options || []).join(", "),
    finish_options: patch.finish_options ? normalizeStringList(patch.finish_options).join(", ") : (current.finish_options || []).join(", "),
    processing_time: patch.processing_time ?? current.processing_time ?? "",
    care_instructions: patch.care_instructions ?? current.care_instructions ?? "",
    source_url: patch.source_url ?? current.source_url ?? "",
    license_notes: patch.license_notes ?? current.license_notes ?? "",
    tags: patch.tags ? normalizeStringList(patch.tags).slice(0, 13).join(", ") : (current.tags || []).join(", "),
    featured: patch.featured ?? current.featured,
    active: patch.active ?? current.active,
  });

  if (!parsed.success) return { ok: false, message: "The proposed edit did not pass product validation." };

  const { error } = await supabase
    .from("products")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", action.product_id);
  if (error) return { ok: false, message: error.message };

  if (mediaUrls.length) {
    await supabase.from("product_media").delete().eq("product_id", action.product_id);
    await supabase.from("product_media").insert(
      mediaUrls.slice(0, 10).map((url, index) => ({
        product_id: action.product_id,
        media_type: /\.(mp4|mov|webm|m4v)$/i.test(url) ? "video" : "image",
        url,
        sort_order: index,
      })),
    );
  }

  revalidatePath("/");
  revalidatePath("/products");
  revalidatePath(`/products/${current.slug}`);
  revalidatePath("/admin");
  revalidatePath(`/admin/products/${action.product_id}`);

  return {
    ok: true,
    message: action.summary || "Product updated.",
    editUrl: `/admin/products/${action.product_id}`,
    publicUrl: `/products/${current.slug}`,
  };
}

async function createEtsyDraftFromAction(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  action: AdminChatAction,
) {
  if (!action.product_id) return { ok: false, message: "Missing product id." };

  const { data, error } = await supabase.from("products").select("*").eq("id", action.product_id).maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Product not found." };

  const product = data as Product;
  if (product.etsy_listing_id || product.etsy_url) {
    return {
      ok: true,
      message: "This product already has an Etsy listing attached.",
      editUrl: `/admin/products/${product.id}`,
      publicUrl: product.etsy_url || `/products/${product.slug}`,
    };
  }

  const [etsyToken, etsySettings] = await Promise.all([getValidEtsyOAuthToken(), getEffectiveEtsyRuntimeSettings()]);
  const missing = etsyDraftRequirements(product, { hasOAuthToken: Boolean(etsyToken?.access_token), settings: etsySettings });
  if (missing.length) {
    return {
      ok: false,
      message: `Etsy draft creation needs these settings first: ${missing.join(", ")}.`,
    };
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
    revalidatePath(`/products/${product.slug}`);
    revalidatePath("/admin");
    revalidatePath("/admin/etsy");

    return {
      ok: true,
      message: "Created an Etsy draft listing. Review photos/files/options in Etsy before publishing.",
      editUrl: `/admin/products/${product.id}`,
      publicUrl: result.url,
    };
  } catch (draftError) {
    return {
      ok: false,
      message: draftError instanceof Error ? draftError.message : "Could not create Etsy draft listing.",
    };
  }
}
