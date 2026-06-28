"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  createOpportunityDraftsFromChatsSheet,
  createProduct,
  generateAiListing,
  generateAiMarketResearch,
  generateAiScoutListing,
  type AiListingState,
  type AiMarketResearchState,
  type AiScoutState,
  type BulkOpportunityDraftState,
} from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { Field, SelectField, SubmitButton, TextArea } from "@/components/form-controls";
import { MediaUpload } from "@/components/media-upload";
import { PasteImageUpload } from "@/components/paste-image-upload";
import { categories } from "@/lib/config";

const initialAiState: AiListingState = {
  ok: false,
  message: "",
};

const initialResearchState: AiMarketResearchState = {
  ok: false,
  message: "",
};

const initialScoutState: AiScoutState = {
  ok: false,
  message: "",
};

const initialBulkDraftState: BulkOpportunityDraftState = {
  ok: false,
  message: "",
};

export function AiListingGenerator() {
  const [state, formAction, pending] = useActionState(generateAiListing, initialAiState);

  return (
    <div className="grid gap-8">
      <BulkOpportunityDrafts />
      <AdminScoutBot />
      <MarketResearchGenerator />

      <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
        <form action={formAction} className="grid h-fit gap-5 rounded-lg border border-white/10 bg-zinc-900/70 p-5 sm:p-7">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-200">Listing assistant</p>
            <h2 className="mt-2 text-xl font-black text-zinc-50">Generate listing draft</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Paste a MakerWorld page URL, copied model text, and an image. The draft stays admin-only until you create it.
            </p>
          </div>
          <Field label="Product idea" name="idea" placeholder="Personalized desk organizer for teachers" />
          <Field label="Source listing URL" name="source_url" placeholder="https://makerworld.com/en/models/..." />
          <TextArea
            label="Paste MakerWorld listing text"
            name="source_text"
            placeholder="Paste the model title, description, profile/details, tags, license notes, print settings, or any copied text from MakerWorld here."
            rows={8}
          />
          <div className="grid gap-3">
            <Field label="Source image URL" name="source_image_url" placeholder="Paste an image URL, or upload/paste an image below" />
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <PasteImageUpload targetInputId="source_image_url" />
              <div className="flex items-start">
                <MediaUpload targetInputId="source_image_url" />
              </div>
            </div>
          </div>
          <SelectField label="Category" name="category" options={categories} />
          <Field label="Target buyer" name="audience" placeholder="Teachers, students, desk setup buyers" />
          <TextArea label="Extra notes" name="notes" placeholder="Mention color options, licensing concern, sizing, or Etsy angle." rows={5} />
          {state.message ? (
            <p className={state.ok ? "text-sm font-semibold text-emerald-300" : "text-sm font-semibold text-red-300"}>
              {state.message}
            </p>
          ) : null}
          <SubmitButton pending={pending}>Generate Draft</SubmitButton>
        </form>

        <AiListingDraftForm draft={state.draft} />
      </div>
    </div>
  );
}

function BulkOpportunityDrafts() {
  const [state, formAction, pending] = useActionState(createOpportunityDraftsFromChatsSheet, initialBulkDraftState);

  return (
    <section className="grid gap-5 rounded-lg border border-amber-300/20 bg-amber-300/[0.04] p-5 sm:p-7">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-200">Bulk product drafts</p>
        <h2 className="mt-2 text-2xl font-black text-zinc-50">Create drafts from the chats list sheet</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
          Reads the Google Sheet tab with chat/opportunity rows, picks high-score or high-priority products, and creates inactive product drafts. Add source links and images later, then use AI fill on each product.
        </p>
      </div>
      <form action={formAction} className="grid gap-4 md:grid-cols-[1fr_1fr_140px_auto] md:items-end">
        <Field label="Spreadsheet ID" name="spreadsheet_id" placeholder="Defaults to PRINTZ_PRODUCT_SHEET_ID" />
        <Field label="Tab name" name="sheet_name" placeholder="Chats List, Chat List, Opportunities..." />
        <Field defaultValue="20" label="Max drafts" name="limit" type="number" />
        <SubmitButton pending={pending}>Create Drafts</SubmitButton>
      </form>
      {state.message ? (
        <p className={state.ok ? "text-sm font-semibold text-emerald-300" : "text-sm font-semibold text-red-300"}>
          {state.message}
        </p>
      ) : null}
    </section>
  );
}

function AdminScoutBot() {
  const [state, formAction, pending] = useActionState(generateAiScoutListing, initialScoutState);

  return (
    <section className="grid gap-6 rounded-lg border border-emerald-300/20 bg-emerald-300/[0.035] p-5 sm:p-7 lg:grid-cols-[0.85fr_1.15fr]">
      <form action={formAction} className="grid h-fit gap-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">Admin scout bot</p>
          <h2 className="mt-2 text-2xl font-black text-zinc-50">Find, analyze, and draft</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Ask about a product idea or source URL. It researches visible signals, flags selling-rights risk, and fills a reviewable listing draft.
          </p>
        </div>
        <TextArea label="Chat / task" name="message" placeholder="Find out if this MakerWorld model is viable to sell, what niche it fits, and draft a listing." rows={5} />
        <Field label="Source URL" name="source_url" placeholder="https://makerworld.com/... or https://printables.com/..." />
        <TextArea label="Pasted source text" name="source_text" placeholder="Paste license, description, tags, comments, or product notes." rows={5} />
        <Field label="Target audience" name="target_audience" placeholder="Teachers, gamers, desk setup buyers, gift buyers" />
        {state.message ? <p className={state.ok ? "text-sm font-semibold text-emerald-300" : "text-sm font-semibold text-red-300"}>{state.message}</p> : null}
        <SubmitButton pending={pending}>Scout and Draft</SubmitButton>
      </form>

      <div className="grid gap-5">
        <div className="rounded-lg border border-white/10 bg-zinc-950/80 p-5">
          {!state.answer ? (
            <p className="text-sm leading-6 text-zinc-400">Scout analysis appears here, including viability and selling-rights risk.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 text-xs font-bold">
                <span className="rounded bg-zinc-800 px-2 py-1">Viability: {state.viabilityScore || 0}/100</span>
                <span className="rounded bg-zinc-800 px-2 py-1">Rights risk: {state.rightsRisk}</span>
              </div>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-zinc-300">{state.answer}</p>
              {state.rightsNotes ? (
                <div className="mt-4 rounded-md border border-amber-300/20 bg-amber-300/[0.06] p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-200">Selling-rights notes</p>
                  <p className="mt-2 text-sm leading-6 text-zinc-300">{state.rightsNotes}</p>
                </div>
              ) : null}
              {state.sourcesToCheck?.length ? (
                <div className="mt-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Sources to verify</p>
                  <ul className="mt-2 grid gap-1 text-sm text-zinc-300">
                    {state.sourcesToCheck.map((source) => <li key={source}>{source}</li>)}
                  </ul>
                </div>
              ) : null}
            </>
          )}
        </div>
        <AiListingDraftForm draft={state.draft} />
      </div>
    </section>
  );
}

function MarketResearchGenerator() {
  const [state, formAction, pending] = useActionState(generateAiMarketResearch, initialResearchState);
  const listing = state.report?.recommended_listing;

  return (
    <section className="grid gap-6 rounded-lg border border-amber-300/20 bg-amber-300/[0.04] p-5 sm:p-7 lg:grid-cols-[0.9fr_1.1fr]">
      <form action={formAction} className="grid h-fit gap-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-200">Market research</p>
          <h2 className="mt-2 text-2xl font-black text-zinc-50">Research Etsy and save a report</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Uses OpenAI web search to look for Etsy-visible patterns, then saves the result into the Trend reports archive.
          </p>
        </div>
        <Field label="Research focus" name="focus" placeholder="Teacher digital downloads, 3D printed desk gifts, seasonal classroom products" />
        <Field label="Product types" name="product_types" placeholder="Digital products, 3D printed products, hybrid bundles" />
        <Field label="Target audience" name="audience" placeholder="Teachers, parents, desk setup buyers, students" />
        <TextArea label="Extra notes" name="notes" placeholder="Ask for a niche, price range, season, or specific next listing idea." rows={4} />
        {state.message ? (
          <p className={state.ok ? "text-sm font-semibold text-emerald-300" : "text-sm font-semibold text-red-300"}>
            {state.message}
          </p>
        ) : null}
        <SubmitButton pending={pending}>Run Market Research</SubmitButton>
      </form>

      <div className="rounded-lg border border-white/10 bg-zinc-950/80 p-5">
        {!state.report ? (
          <div className="grid h-full min-h-72 place-items-center text-center text-zinc-400">
            <div>
              <h3 className="text-lg font-bold text-zinc-200">Research output appears here</h3>
              <p className="mt-2 max-w-md text-sm leading-6">
                After it runs, the report is also saved permanently under Trend reports.
              </p>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-200">{state.report.report_date}</p>
            <h3 className="mt-2 text-2xl font-black text-zinc-50">{state.report.title}</h3>
            <p className="mt-3 text-sm leading-6 text-zinc-300">{state.report.summary}</p>

            <div className="mt-5 rounded-md border border-amber-300/20 bg-amber-300/[0.06] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-200">Best listing to make</p>
              <h4 className="mt-2 text-lg font-black text-zinc-50">{listing?.title || "No recommendation returned"}</h4>
              <p className="mt-2 text-sm leading-6 text-zinc-300">{listing?.description}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                {listing?.product_type ? <span className="rounded bg-zinc-800 px-2 py-1">{listing.product_type}</span> : null}
                {listing?.price ? <span className="rounded bg-zinc-800 px-2 py-1">{listing.price}</span> : null}
                {listing?.category ? <span className="rounded bg-zinc-800 px-2 py-1">{listing.category}</span> : null}
              </div>
            </div>

            <Link className="mt-5 inline-flex text-sm font-bold text-amber-200" href="/admin/trends">
              Open saved report archive
            </Link>
            {state.productId ? (
              <Link className="ml-4 mt-5 inline-flex text-sm font-bold text-emerald-200" href={`/admin/products/${state.productId}`}>
                Open created product draft
              </Link>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}

export function AiListingDraftForm({
  draft,
}: {
  draft?: {
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
}) {
  if (!draft) {
    return (
      <div className="rounded-lg border border-dashed border-white/15 bg-zinc-900/40 p-8 text-zinc-400">
        Generated listing fields will appear here for review before saving.
      </div>
    );
  }

  return (
    <ActionForm action={createProduct} className="grid gap-5 rounded-lg border border-white/10 bg-zinc-900/70 p-5 sm:p-7">
      {(state, pending) => (
        <>
          <div>
            <h2 className="text-xl font-black text-zinc-50">Review and create product</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Edit anything before saving. This will create a real product in Supabase.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field defaultValue={draft.name} error={state.errors?.name} label="Product name" name="name" required />
            <Field defaultValue={draft.slug} error={state.errors?.slug} label="Slug" name="slug" />
          </div>
          <TextArea defaultValue={draft.short_description} error={state.errors?.short_description} label="Short description" name="short_description" required rows={3} />
          <TextArea defaultValue={draft.full_description} error={state.errors?.full_description} label="Full description" name="full_description" rows={7} />
          <div className="grid gap-5 sm:grid-cols-2">
            <SelectField defaultValue={draft.category} error={state.errors?.category} label="Category" name="category" options={categories} />
            <Field defaultValue={draft.price} error={state.errors?.price} label="Price" name="price" type="number" />
          </div>
          <Field defaultValue={draft.etsy_url} error={state.errors?.etsy_url} label="Etsy listing URL" name="etsy_url" />
          <Field defaultValue={draft.main_image_url} error={state.errors?.main_image_url} label="Main image URL" name="main_image_url" />
          <Field defaultValue={draft.video_url} error={state.errors?.video_url} label="Video URL" name="video_url" />
          <section className="grid gap-3 rounded-lg border border-white/10 bg-zinc-950 p-5">
            <TextArea
              defaultValue={draft.gallery_media_urls}
              label="Gallery image / GIF / video URLs"
              name="gallery_media_urls"
              placeholder="One media URL per line"
              rows={4}
            />
            <MediaUpload append targetInputId="gallery_media_urls" />
          </section>
          <div className="grid gap-5 sm:grid-cols-2">
            <TextArea defaultValue={draft.materials} error={state.errors?.materials} label="Materials" name="materials" rows={4} />
            <TextArea defaultValue={draft.dimensions} error={state.errors?.dimensions} label="Dimensions" name="dimensions" rows={4} />
          </div>
          <TextArea defaultValue={draft.customization_notes} error={state.errors?.customization_notes} label="Customization notes" name="customization_notes" rows={4} />
          <section className="grid gap-5 rounded-lg border border-white/10 bg-zinc-950 p-5">
            <div>
              <h2 className="text-lg font-black text-zinc-50">Buyer customization options</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Review these before creating the product. They help the public listing explain what buyers can request.
              </p>
            </div>
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-200">
              <input defaultChecked={draft.personalization_enabled} name="personalization_enabled" type="checkbox" />
              Personalization available
            </label>
            <TextArea
              defaultValue={draft.personalization_prompt}
              error={state.errors?.personalization_prompt}
              label="Personalization prompt"
              name="personalization_prompt"
              rows={3}
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field defaultValue={draft.color_options} error={state.errors?.color_options} label="Color options" name="color_options" />
              <Field defaultValue={draft.size_options} error={state.errors?.size_options} label="Size options" name="size_options" />
              <Field defaultValue={draft.finish_options} error={state.errors?.finish_options} label="Finish options" name="finish_options" />
              <Field defaultValue={draft.processing_time} error={state.errors?.processing_time} label="Processing time" name="processing_time" />
            </div>
            <TextArea
              defaultValue={draft.care_instructions}
              error={state.errors?.care_instructions}
              label="Care instructions"
              name="care_instructions"
              rows={3}
            />
          </section>
          <Field defaultValue={draft.source_url} error={state.errors?.source_url} label="Source model listing URL" name="source_url" />
          <TextArea defaultValue={draft.license_notes} error={state.errors?.license_notes} label="License / seller notes" name="license_notes" rows={4} />
          <Field defaultValue={draft.tags} error={state.errors?.tags} label="Tags" name="tags" />
          <div className="flex flex-wrap gap-6 text-sm font-semibold text-zinc-200">
            <label className="inline-flex items-center gap-2">
              <input defaultChecked={draft.featured} name="featured" type="checkbox" /> Featured
            </label>
            <label className="inline-flex items-center gap-2">
              <input defaultChecked={draft.active} name="active" type="checkbox" /> Active
            </label>
          </div>
          {state.message ? <p className="text-sm font-semibold text-red-300">{state.message}</p> : null}
          <SubmitButton pending={pending}>Create Product</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
