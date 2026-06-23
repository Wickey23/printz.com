"use client";

import { createProduct, updateProduct } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { Field, SelectField, SubmitButton, TextArea } from "@/components/form-controls";
import { MediaUpload } from "@/components/media-upload";
import { categories } from "@/lib/config";
import type { Product } from "@/lib/types";

export function ProductForm({ galleryMediaUrls = [], product }: { galleryMediaUrls?: string[]; product?: Product }) {
  const action = product ? updateProduct : createProduct;

  return (
    <ActionForm action={action} className="grid gap-5 rounded-lg border border-white/10 bg-zinc-900/70 p-5 sm:p-7">
      {(state, pending) => (
        <>
          {product ? <input name="id" type="hidden" value={product.id} /> : null}
          <div className="grid gap-5 sm:grid-cols-2">
            <Field defaultValue={product?.name} error={state.errors?.name} label="Product name" name="name" required />
            <Field defaultValue={product?.slug} error={state.errors?.slug} label="Slug" name="slug" placeholder="auto-generated if blank" />
          </div>
          <TextArea
            defaultValue={product?.short_description}
            error={state.errors?.short_description}
            label="Short description"
            name="short_description"
            required
            rows={3}
          />
          <TextArea
            defaultValue={product?.full_description}
            error={state.errors?.full_description}
            label="Full description"
            name="full_description"
            rows={7}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <SelectField defaultValue={product?.category} error={state.errors?.category} label="Category" name="category" options={categories} />
            <Field defaultValue={product?.price ?? ""} error={state.errors?.price} label="Price" name="price" placeholder="28.00" type="number" />
          </div>
          <Field defaultValue={product?.etsy_url} error={state.errors?.etsy_url} label="Etsy listing URL" name="etsy_url" placeholder="https://www.etsy.com/listing/..." />
          <div className="grid gap-2">
            <div className="flex items-end justify-between gap-3">
              <div className="flex-1">
                <Field
                  defaultValue={product?.main_image_url}
                  error={state.errors?.main_image_url}
                  label="Main image URL"
                  name="main_image_url"
                  placeholder="Upload or paste an image URL"
                />
              </div>
              <MediaUpload targetInputId="main_image_url" />
            </div>
          </div>
          <Field defaultValue={product?.video_url} error={state.errors?.video_url} label="Video URL" name="video_url" placeholder="YouTube, TikTok, Instagram, or direct video URL" />
          <section className="grid gap-3 rounded-lg border border-white/10 bg-zinc-950 p-5">
            <div>
              <h2 className="text-lg font-black text-zinc-50">Listing media gallery</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Add one image, GIF, or direct video URL per line. These show on the public listing below the main image.
              </p>
            </div>
            <TextArea
              defaultValue={galleryMediaUrls.join("\n")}
              label="Gallery image / GIF / video URLs"
              name="gallery_media_urls"
              placeholder="https://...\nhttps://...\nhttps://..."
              rows={5}
            />
            <div className="flex">
              <MediaUpload append targetInputId="gallery_media_urls" />
            </div>
          </section>
          <div className="grid gap-5 sm:grid-cols-2">
            <TextArea defaultValue={product?.materials} error={state.errors?.materials} label="Materials" name="materials" rows={4} />
            <TextArea defaultValue={product?.dimensions} error={state.errors?.dimensions} label="Dimensions" name="dimensions" rows={4} />
          </div>
          <TextArea
            defaultValue={product?.customization_notes}
            error={state.errors?.customization_notes}
            label="Customization notes"
            name="customization_notes"
            rows={4}
          />
          <section className="grid gap-5 rounded-lg border border-white/10 bg-zinc-950 p-5">
            <div>
              <h2 className="text-lg font-black text-zinc-50">Buyer customization options</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                These appear on the public listing so buyers understand color, size, finish, personalization, and care options before opening Etsy.
              </p>
            </div>
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-200">
              <input defaultChecked={product?.personalization_enabled ?? false} name="personalization_enabled" type="checkbox" />
              Personalization available
            </label>
            <TextArea
              defaultValue={product?.personalization_prompt}
              error={state.errors?.personalization_prompt}
              label="Personalization prompt"
              name="personalization_prompt"
              placeholder="Example: Enter the name, initials, room number, or short phrase you want on the item."
              rows={3}
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                defaultValue={product?.color_options?.join(", ")}
                error={state.errors?.color_options}
                label="Color options"
                name="color_options"
                placeholder="Black, White, Marble, Gold, Custom color"
              />
              <Field
                defaultValue={product?.size_options?.join(", ")}
                error={state.errors?.size_options}
                label="Size options"
                name="size_options"
                placeholder="Small, Medium, Large, Custom size"
              />
              <Field
                defaultValue={product?.finish_options?.join(", ")}
                error={state.errors?.finish_options}
                label="Finish options"
                name="finish_options"
                placeholder="Matte, Silk, Marble, Gloss accent"
              />
              <Field
                defaultValue={product?.processing_time}
                error={state.errors?.processing_time}
                label="Processing time"
                name="processing_time"
                placeholder="Made to order in 2-4 business days"
              />
            </div>
            <TextArea
              defaultValue={product?.care_instructions}
              error={state.errors?.care_instructions}
              label="Care instructions"
              name="care_instructions"
              placeholder="Keep away from high heat. Clean gently with a dry or slightly damp cloth."
              rows={3}
            />
          </section>
          <Field
            defaultValue={product?.source_url}
            error={state.errors?.source_url}
            label="Source model listing URL"
            name="source_url"
            placeholder="https://www.printables.com/model/... or https://makerworld.com/en/models/..."
          />
          <TextArea
            defaultValue={product?.license_notes}
            error={state.errors?.license_notes}
            label="License / seller notes"
            name="license_notes"
            rows={4}
          />
          <Field defaultValue={product?.tags?.join(", ")} error={state.errors?.tags} label="Tags" name="tags" placeholder="desk, decor, custom" />
          <div className="flex flex-wrap gap-6 text-sm font-semibold text-zinc-200">
            <label className="inline-flex items-center gap-2">
              <input defaultChecked={product?.featured ?? false} name="featured" type="checkbox" /> Featured
            </label>
            <label className="inline-flex items-center gap-2">
              <input defaultChecked={product?.active ?? true} name="active" type="checkbox" /> Active
            </label>
          </div>
          {state.message ? (
            <p className={state.ok ? "text-sm font-semibold text-emerald-300" : "text-sm font-semibold text-red-300"}>
              {state.message}
            </p>
          ) : null}
          <SubmitButton pending={pending}>{product ? "Update Product" : "Create Product"}</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
