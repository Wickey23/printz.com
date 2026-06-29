import { z } from "zod";

const urlOrEmpty = z
  .string()
  .trim()
  .refine((value) => !value || z.url().safeParse(value).success, "Enter a valid URL.")
  .optional()
  .transform((value) => (value ? value : null));

export const suggestionSchema = z.object({
  name: z.string().trim().min(2, "Name is required.").max(120),
  email: z.email("Enter a valid email.").trim().max(180),
  title: z.string().trim().min(3, "Idea title is required.").max(180),
  description: z.string().trim().min(10, "Add a little more detail.").max(2500),
  category: z.string().trim().min(2).max(120),
  reference_link: urlOrEmpty,
  budget_range: z.string().trim().max(120).optional().transform((value) => value || null),
});

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Name is required.").max(120),
  email: z.email("Enter a valid email.").trim().max(180),
  message: z.string().trim().min(10, "Message must be at least 10 characters.").max(3000),
});

export const productSchema = z.object({
  name: z.string().trim().min(2).max(180),
  slug: z.string().trim().min(2).max(220),
  short_description: z.string().trim().min(5).max(280),
  full_description: z.string().trim().max(5000).optional().transform((value) => value || null),
  category: z.string().trim().min(2).max(120),
  price: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? Number(value) : null))
    .refine((value) => value === null || (Number.isFinite(value) && value >= 0), "Enter a valid price."),
  etsy_url: urlOrEmpty,
  main_image_url: urlOrEmpty,
  video_url: urlOrEmpty,
  drive_media_folder_url: urlOrEmpty,
  materials: z.string().trim().max(1000).optional().transform((value) => value || null),
  dimensions: z.string().trim().max(1000).optional().transform((value) => value || null),
  customization_notes: z.string().trim().max(1500).optional().transform((value) => value || null),
  source_url: urlOrEmpty,
  license_notes: z.string().trim().max(2000).optional().transform((value) => value || null),
  tags: z
    .string()
    .trim()
    .optional()
    .transform((value) =>
      value
        ? value
            .split(",")
            .map((tag) => tag.trim())
    .filter(Boolean)
        : [],
    ),
  personalization_enabled: z.boolean(),
  personalization_prompt: z.string().trim().max(1000).optional().transform((value) => value || null),
  color_options: z
    .string()
    .trim()
    .optional()
    .transform((value) => splitList(value)),
  size_options: z
    .string()
    .trim()
    .optional()
    .transform((value) => splitList(value)),
  finish_options: z
    .string()
    .trim()
    .optional()
    .transform((value) => splitList(value)),
  processing_time: z.string().trim().max(500).optional().transform((value) => value || null),
  care_instructions: z.string().trim().max(1500).optional().transform((value) => value || null),
  sales_likelihood_score: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? Number(value) : 50))
    .refine((value) => Number.isFinite(value) && value >= 1 && value <= 100, "Enter a score from 1 to 100."),
  sales_likelihood_notes: z.string().trim().max(2000).optional().transform((value) => value || null),
  featured: z.boolean(),
  active: z.boolean(),
});

function splitList(value?: string) {
  return value
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}
